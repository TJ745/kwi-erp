"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  setRolePermissions,
  setUserCompanyAccess,
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
