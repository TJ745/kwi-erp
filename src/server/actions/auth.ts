"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { loginSchema } from "@/lib/schemas/auth";
import { err, ok, type ActionResult } from "@/lib/result";
import { auth } from "@/server/auth/auth";
import { requireAuth } from "@/server/auth/guards";
import { recordAudit } from "@/server/audit/log";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/logger";

/**
 * Sign-in for the login form.
 *
 * Rate limiting, account lockout, and audit logging deliberately DO NOT live
 * here — they are Better Auth request hooks (src/server/auth/login-hooks.ts),
 * so they also cover direct calls to the public /api/auth/sign-in/email
 * endpoint. Duplicating them here would double-count the rate limiter.
 */
export async function loginAction(
  rawInput: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_form";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return err("VALIDATION", "Please correct the highlighted fields.", { fieldErrors });
  }

  const { email, password } = parsed.data;
  const headerList = await headers();

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: headerList });
  } catch (error) {
    if (error instanceof APIError) {
      // Covers wrong password, unknown email, locked, disabled, and rate
      // limited. The hook has already decided the message and recorded it.
      const status = String(error.status);
      if (status === "TOO_MANY_REQUESTS" || error.statusCode === 429) {
        return err("RATE_LIMITED", "Too many attempts. Please try again in a few minutes.");
      }
      return err("UNAUTHENTICATED", "Invalid email or password.");
    }
    logger.error("Login failed unexpectedly", {
      error: error instanceof Error ? error.message : String(error),
    });
    return err("INTERNAL", "Something went wrong. Please try again.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { mustChangePassword: true },
  });

  return ok({
    redirectTo: user?.mustChangePassword ? "/change-password" : "/dashboard",
  });
}

export async function logoutAction(): Promise<never> {
  const headerList = await headers();

  try {
    const ctx = await requireAuth();
    await recordAudit(ctx, {
      action: "LOGOUT",
      entityType: "USER",
      entityId: ctx.userId,
      summary: "Signed out",
    });
  } catch {
    // Already signed out or the session is invalid — still clear the cookie.
  }

  await auth.api.signOut({ headers: headerList });
  redirect("/login");
}
