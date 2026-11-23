"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import { err, ok, type ActionResult } from "@/lib/result";
import { requirePermission } from "@/server/auth/guards";
import { AppError } from "@/lib/result";
import { logger } from "@/server/logger";
import {
  createCredential,
  deleteCredential,
  revealCredential,
  toggleFavorite,
  updateCredential,
} from "@/server/services/vault/credentials";
import { createCredentialGrant, revokeCredentialGrant } from "@/server/services/vault/grants";
import { lockVault, unlockVault } from "@/server/services/vault/session";
import { generateSecret } from "@/server/services/vault/generator";

/**
 * Vault actions — docs/SECURITY.md §5.
 *
 * The reveal action is deliberately hand-written rather than using
 * defineAction, so nothing about it is generic: no input echo, no audit diff
 * that could carry the value, and an explicit `no-store` contract.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const credentialFields = {
  name: z.string().trim().min(2, "Name is required").max(150),
  categoryId: z.string().min(1, "Select a category"),
  companyId: z
    .string()
    .optional()
    .transform((v) => (v === "" || v === "none" ? undefined : v)),
  url: optionalText(300),
  username: optionalText(150),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: optionalText(2000),
};

export const createCredentialAction = defineAction({
  permission: "vault.create",
  schema: z
    .object({
      ...credentialFields,
      secret: z.string().min(1, "A password or key is required").max(4096),
    })
    .strict(),
  audit: { action: "CREATE", entity: "CREDENTIAL" },
  handler: async ({ input, ctx, audit }) => {
    const credential = await createCredential(ctx, input);
    // The summary names the credential, never its value. The audit redaction
    // list also covers `secret`, but the summary is written by hand so it can
    // never accidentally include one.
    audit.record({
      entityId: credential.id,
      companyId: credential.companyId,
      summary: `Created credential "${credential.name}" in ${credential.categoryName}`,
    });
    return { id: credential.id };
  },
  revalidate: () => ["/it/vault"],
});

export const updateCredentialAction = defineAction({
  permission: "vault.update",
  schema: z
    .object({
      id: z.string().min(1),
      ...credentialFields,
      // Absent means "leave the existing secret alone".
      secret: z.string().max(4096).optional(),
    })
    .strict(),
  audit: { action: "UPDATE", entity: "CREDENTIAL" },
  handler: async ({ input, ctx, audit }) => {
    const result = await updateCredential(ctx, {
      ...input,
      secret: input.secret === "" ? undefined : input.secret,
    });
    audit.record({
      entityId: input.id,
      companyId: result.companyId,
      summary: result.rotated
        ? `Rotated the secret for "${result.after.name}"`
        : `Updated credential "${result.after.name}"`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/it/vault"],
});

export const deleteCredentialAction = defineAction({
  permission: "vault.delete",
  schema: z.object({ id: z.string().min(1) }).strict(),
  audit: { action: "DELETE", entity: "CREDENTIAL" },
  handler: async ({ input, ctx, audit }) => {
    const credential = await deleteCredential(ctx, input.id);
    audit.record({
      entityId: input.id,
      companyId: credential.companyId,
      summary: `Deleted credential "${credential.name}"`,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/it/vault"],
});

export const toggleFavoriteAction = defineAction({
  permission: "vault.view",
  schema: z.object({ credentialId: z.string().min(1) }).strict(),
  handler: async ({ input, ctx }) => toggleFavorite(ctx, input.credentialId),
  revalidate: () => ["/it/vault"],
});

// --- Unlock ------------------------------------------------------------------

export const unlockVaultAction = defineAction({
  permission: "vault.view",
  schema: z.object({ password: z.string().min(1, "Enter your password") }).strict(),
  handler: async ({ input, ctx }) => {
    await unlockVault(ctx, input.password);
    return { unlocked: true as const };
  },
  revalidate: () => ["/it/vault"],
});

export const lockVaultAction = defineAction({
  permission: "vault.view",
  schema: z.object({}).strict(),
  handler: async ({ ctx }) => {
    await lockVault(ctx);
    return { locked: true as const };
  },
  revalidate: () => ["/it/vault"],
});

// --- Reveal ------------------------------------------------------------------

/**
 * Returns one plaintext secret.
 *
 * Written by hand rather than through defineAction so that:
 *   - the input is never echoed back
 *   - no audit diff is produced that could carry the value
 *   - the error path cannot leak which gate failed
 *
 * The service applies permission, unlock, grant, rate limit, and audit.
 */
export async function revealCredentialAction(
  rawInput: unknown,
): Promise<ActionResult<{ secret: string }>> {
  const parsed = z
    .object({ id: z.string().min(1) })
    .strict()
    .safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid request.");

  let ctx;
  try {
    ctx = await requirePermission("vault.reveal");
  } catch (error) {
    return error instanceof AppError
      ? err(error.code, error.message)
      : err("FORBIDDEN", "You do not have permission to reveal credentials.");
  }

  try {
    const secret = await revealCredential(ctx, parsed.data.id);
    return ok({ secret });
  } catch (error) {
    if (error instanceof AppError) return err(error.code, error.message);

    // A decryption failure is logged WITHOUT the payload, and reported
    // generically — the failure mode itself is information.
    logger.error("Credential reveal failed", {
      userId: ctx.userId,
      credentialId: parsed.data.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return err("INTERNAL", "The credential could not be read.");
  }
}

/** Server-side generation, so the value comes from a CSPRNG we control. */
export async function generatePasswordAction(
  rawInput: unknown,
): Promise<ActionResult<{ password: string }>> {
  const parsed = z
    .object({
      length: z.coerce.number().int().min(8).max(128).default(20),
      symbols: z.boolean().default(true),
      digits: z.boolean().default(true),
      excludeAmbiguous: z.boolean().default(false),
    })
    .strict()
    .safeParse(rawInput);

  if (!parsed.success) return err("VALIDATION", "Invalid options.");

  try {
    await requirePermission("vault.create");
  } catch {
    return err("FORBIDDEN", "You do not have permission to use the generator.");
  }

  return ok({ password: generateSecret(parsed.data) });
}

// --- Per-credential grants ---------------------------------------------------

/**
 * Grants narrow access rather than widening it, and there is no administrator
 * override, so the service refuses any change that would leave nobody able to
 * manage the credential. Both actions require `vault.grant`, which no seeded
 * role except SUPER_ADMIN holds.
 */
export const createCredentialGrantAction = defineAction({
  permission: "vault.grant",
  schema: z
    .object({
      credentialId: z.string().min(1),
      subjectKind: z.enum(["USER", "ROLE"]),
      subjectId: z.string().min(1),
      level: z.enum(["READ", "REVEAL", "MANAGE"]),
      expiresAt: z
        .string()
        .optional()
        .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
        .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date"),
    })
    .strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "CREDENTIAL" },
  handler: async ({ input, ctx, audit }) => {
    const result = await createCredentialGrant(ctx, input);
    audit.record({
      entityId: input.credentialId,
      ...(result.credential.companyId ? { companyId: result.credential.companyId } : {}),
      summary:
        `Granted ${input.level} on "${result.credential.name}" to ${result.subjectLabel}` +
        (input.expiresAt ? ` until ${input.expiresAt.toISOString().slice(0, 10)}` : "") +
        (result.nowRestricted ? " — this credential is now restricted to named grantees" : ""),
      after: { level: input.level, subject: result.subjectLabel, kind: input.subjectKind },
    });
    return { id: result.grant.id };
  },
  revalidate: () => ["/it/vault"],
});

export const revokeCredentialGrantAction = defineAction({
  permission: "vault.grant",
  schema: z.object({ id: z.string().min(1), credentialId: z.string().min(1) }).strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "CREDENTIAL" },
  handler: async ({ input, ctx, audit }) => {
    const result = await revokeCredentialGrant(ctx, input);
    audit.record({
      entityId: input.credentialId,
      ...(result.credential.companyId ? { companyId: result.credential.companyId } : {}),
      summary:
        `Revoked a grant on "${result.credential.name}"` +
        (result.nowOpen
          ? " — with no grants left it is open to everyone holding the vault permission again"
          : ""),
    });
    return { ok: true as const };
  },
  revalidate: () => ["/it/vault"],
});
