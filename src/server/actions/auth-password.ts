"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { err, ok, type ActionResult } from "@/lib/result";
import { auth } from "@/server/auth/auth";
import { requireAuth } from "@/server/auth/guards";
import { recordAudit } from "@/server/audit/log";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/logger";

/**
 * Changing a password requires the current one and revokes every OTHER session,
 * so a stolen cookie elsewhere is invalidated — docs/SECURITY.md §2.
 */
export async function changePasswordAction(
  rawInput: unknown,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireAuth();

  const parsed = changePasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_form";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return err("VALIDATION", "Please correct the highlighted fields.", { fieldErrors });
  }

  const headerList = await headers();

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: headerList,
    });
  } catch (error) {
    if (error instanceof APIError) {
      // The only realistic cause is a wrong current password; report it on the
      // field rather than as a generic form error.
      return err("VALIDATION", "Password could not be changed.", {
        fieldErrors: { currentPassword: ["That is not your current password"] },
      });
    }
    logger.error("Password change failed", {
      userId: ctx.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return err("INTERNAL", "Something went wrong. Please try again.");
  }

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { mustChangePassword: false },
  });

  // Never log or audit the password itself — only that it changed.
  await recordAudit(ctx, {
    action: "UPDATE",
    entityType: "USER",
    entityId: ctx.userId,
    summary: "Changed own password; other sessions revoked",
  });

  return ok({ ok: true } as const);
}
