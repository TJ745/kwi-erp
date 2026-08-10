import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getEnv } from "@/lib/env";
import { prisma } from "@/server/db/client";
import { afterSignIn, beforeSignIn, type SignInAttempt } from "./login-hooks";
import { hashPassword, verifyPassword } from "./password";

const env = getEnv();

/**
 * Better Auth instance — docs/SECURITY.md §2.
 *
 * Argon2id replaces the default scrypt hasher (ADR-002). `@node-rs/argon2` is a
 * native module, so every auth route must run on the Node.js runtime; it cannot
 * run on edge.
 */
export const auth = betterAuth({
  appName: "OMS",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),

  emailAndPassword: {
    enabled: true,
    // Length beats composition rules. Enforced again in the login schema so the
    // message is friendly rather than a raw library error.
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // Sign-up is administrative only: users are created by an admin in
    // /settings/users, never self-registered.
    disableSignUp: true,
    autoSignIn: false,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },

  session: {
    // Absolute lifetime 7 days, refreshed once a day of activity.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      // Short cache only; permission changes must take effect quickly.
      enabled: true,
      maxAge: 60,
    },
  },

  user: {
    modelName: "User",
    // Fields the client may never set on itself. Role and status changes go
    // through the admin actions, which check users.manage.
    additionalFields: {
      status: { type: "string", required: false, input: false },
      roleId: { type: "string", required: false, input: false },
      employeeId: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
      failedLoginCount: { type: "number", required: false, input: false },
      lockedUntil: { type: "date", required: false, input: false },
    },
  },

  account: { modelName: "Account" },
  verification: { modelName: "Verification" },

  advanced: {
    cookiePrefix: "oms",
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
    },
  },

  trustedOrigins: [env.APP_URL],

  /**
   * Two limiters would otherwise race. Better Auth's built-in limiter is
   * in-memory by default — per-instance, so unreliable on serverless — and its
   * default sign-in rule is stricter than ours, which would mask our own limit
   * and produce inconsistent thresholds across instances.
   *
   * Resolution: our DATABASE-backed limiter (login-hooks.ts) is the binding
   * constraint at 5 attempts / 15 min. Better Auth's stays enabled as a coarse
   * backstop for the other auth endpoints, with the sign-in rule widened so it
   * never fires first.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 900, max: 30 },
    },
  },

  /**
   * Rate limiting, lockout, and audit logging live HERE rather than in the
   * login Server Action, because /api/auth/sign-in/email is a public endpoint.
   * Enforcing them only in the action would let an attacker bypass all three
   * by posting to that route directly.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const attempt = readAttempt(ctx);
      if (attempt) await beforeSignIn(attempt);
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const attempt = readAttempt(ctx);
      if (!attempt) return;

      // An APIError in `returned` means the endpoint rejected the credentials.
      const succeeded = !(ctx.context.returned instanceof APIError);
      await afterSignIn(attempt, succeeded);
    }),
  },

  // Must be last: bridges Better Auth's cookie handling into Next.js.
  plugins: [nextCookies()],
});

/** Extracts the attempt details from a sign-in request, or null if malformed. */
function readAttempt(ctx: {
  body?: unknown;
  headers?: Headers | undefined;
}): SignInAttempt | null {
  const body = ctx.body as { email?: unknown } | undefined;
  if (typeof body?.email !== "string" || body.email.length === 0) return null;

  const headers = ctx.headers;
  const forwarded = headers?.get("x-forwarded-for");

  return {
    email: body.email,
    ip: forwarded?.split(",")[0]?.trim() ?? "unknown",
    userAgent: headers?.get("user-agent") ?? null,
  };
}

export type Auth = typeof auth;
