import "server-only";
import { APIError } from "better-auth/api";
import { recordSystemAudit } from "@/server/audit/log";
import { prisma } from "@/server/db/client";
import { consumeRateLimit, resetRateLimit } from "./rate-limit";

/**
 * Sign-in security controls.
 *
 * These live in Better Auth's request hooks rather than in the login Server
 * Action, because `/api/auth/sign-in/email` is a PUBLIC endpoint. Putting rate
 * limiting, lockout, and audit logging only in the action would let an attacker
 * bypass all three by posting to that route directly.
 *
 * See docs/SECURITY.md §2.
 */

export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_MINUTES = 15;

/**
 * Identical for unknown email, wrong password, locked, and disabled — so valid
 * accounts cannot be enumerated by comparing responses.
 */
const GENERIC_FAILURE = "Invalid email or password";

export type SignInAttempt = { email: string; ip: string; userAgent: string | null };

/** Runs BEFORE the credentials are checked. */
export async function beforeSignIn({ email, ip }: SignInAttempt): Promise<void> {
  const normalised = email.toLowerCase();

  // Limit per-account and per-source: one blocks targeting a single user, the
  // other blocks spraying many accounts from one origin.
  try {
    await consumeRateLimit("login", normalised);
    await consumeRateLimit("login", ip);
  } catch {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Too many attempts. Please try again in a few minutes.",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { status: true, lockedUntil: true },
  });
  if (!user) return; // Same path as a wrong password — no enumeration signal.

  if (user.status !== "ACTIVE" || (user.lockedUntil && user.lockedUntil > new Date())) {
    throw new APIError("UNAUTHORIZED", { message: GENERIC_FAILURE });
  }
}

/** Runs AFTER the credentials are checked, for both outcomes. */
export async function afterSignIn(
  attempt: SignInAttempt,
  succeeded: boolean,
): Promise<void> {
  const email = attempt.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, failedLoginCount: true },
  });

  if (!user) {
    // Repeated attempts against unknown addresses are themselves a signal.
    await recordSystemAudit({
      action: "LOGIN_FAILED",
      entityType: "USER",
      entityId: "unknown",
      actorLabel: email,
      summary: "Sign-in attempt for an unknown email",
      ipAddress: attempt.ip,
      userAgent: attempt.userAgent,
    });
    return;
  }

  if (succeeded) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await resetRateLimit("login", email);
    await resetRateLimit("login", attempt.ip);

    await recordSystemAudit({
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      actorLabel: `${user.name} <${user.email}>`,
      summary: "Signed in",
      ipAddress: attempt.ip,
      userAgent: attempt.userAgent,
    });
    return;
  }

  const nextCount = user.failedLoginCount + 1;
  const shouldLock = nextCount >= MAX_FAILED_LOGINS;

  await prisma.user.update({
    where: { id: user.id },
    data: shouldLock
      ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
      : { failedLoginCount: nextCount },
  });

  await recordSystemAudit({
    action: "LOGIN_FAILED",
    entityType: "USER",
    entityId: user.id,
    actorLabel: `${user.name} <${user.email}>`,
    summary: shouldLock
      ? `Failed sign-in; account locked for ${LOCKOUT_MINUTES} minutes`
      : `Failed sign-in attempt (${nextCount}/${MAX_FAILED_LOGINS})`,
    ipAddress: attempt.ip,
    userAgent: attempt.userAgent,
  });
}
