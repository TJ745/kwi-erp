"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  removeUserPermissionOverride,
  setRolePermissions,
  setUserCompanyAccess,
  setUserPermissionOverride,
  updateUserRole,
  updateUserStatus,
} from "@/server/services/users";

/**
 * User and role administration actions.
 *
 * Each one is a thin declaration: the pipeline handles authenticate →
 * authorise → validate → execute → audit → revalidate → return.
 */

export const updateUserRoleAction = defineAction({
  permission: "users.manage",
  schema: z.object({ userId: z.string().min(1), roleId: z.string().min(1) }).strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await updateUserRole(ctx, input);
    audit.record({
      entityId: input.userId,
      summary: `Changed role for ${result.user.name} from ${result.before.roleKey} to ${result.after.roleKey}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/settings/users"],
});

export const updateUserStatusAction = defineAction({
  permission: "users.manage",
  schema: z
    .object({
      userId: z.string().min(1),
      status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
    })
    .strict(),
  audit: { action: "UPDATE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await updateUserStatus(ctx, input);
    audit.record({
      entityId: input.userId,
      summary: `Set ${result.user.name} to ${input.status}${
        input.status === "ACTIVE" ? "" : "; sessions revoked"
      }`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/settings/users"],
});

export const setUserCompanyAccessAction = defineAction({
  permission: "users.manage",
  schema: z
    .object({
      userId: z.string().min(1),
      companyIds: z.array(z.string().min(1)).max(50),
    })
    .strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setUserCompanyAccess(ctx, input);
    audit.record({
      entityId: input.userId,
      summary: `Updated company access for ${result.user.name}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/settings/users"],
});

export const setRolePermissionsAction = defineAction({
  permission: "roles.manage",
  schema: z
    .object({
      roleId: z.string().min(1),
      permissionKeys: z.array(z.string().min(1)).max(500),
    })
    .strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "ROLE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setRolePermissions(ctx, input);
    audit.record({
      entityId: input.roleId,
      summary: `Updated permissions for role ${result.role.key} (${String(
        result.after.permissions.length,
      )} granted)`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/settings/roles", `/settings/roles/${input.roleId}`],
});

/**
 * Per-user permission overrides.
 *
 * The escalation guards live in the service (it may not grant a permission the
 * actor lacks, may not target a peer or senior, and may not target the actor
 * themselves). The audit verb is PERMISSION_CHANGE, matching the role change,
 * so a review of who gained access reads as one list.
 */
export const setUserPermissionOverrideAction = defineAction({
  permission: "users.manage",
  schema: z
    .object({
      userId: z.string().min(1),
      permissionKey: z.string().min(1),
      effect: z.enum(["ALLOW", "DENY"]),
      expiresAt: z
        .string()
        .optional()
        .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
        .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date"),
      reason: z.string().trim().max(500).optional(),
    })
    .strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setUserPermissionOverride(ctx, input);
    audit.record({
      entityId: input.userId,
      summary: `${input.effect === "ALLOW" ? "Granted" : "Denied"} "${result.permission.key}" for ${result.user.name}${
        input.expiresAt ? ` until ${input.expiresAt.toISOString().slice(0, 10)}` : ""
      }${input.reason ? ` (${input.reason})` : ""}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/settings/users"],
});

export const removeUserPermissionOverrideAction = defineAction({
  permission: "users.manage",
  schema: z
    .object({ userId: z.string().min(1), permissionKey: z.string().min(1) })
    .strict(),
  audit: { action: "PERMISSION_CHANGE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await removeUserPermissionOverride(ctx, input);
    audit.record({
      entityId: input.userId,
      summary: `Removed the "${result.permission.key}" override for ${result.user.name}; their role now decides`,
      before: result.before,
      after: { effect: null },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/settings/users"],
});
