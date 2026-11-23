"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  createRole,
  createUser,
  deleteRole,
  linkUserEmployee,
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

export const linkUserEmployeeAction = defineAction({
  permission: "users.manage",
  schema: z
    .object({
      userId: z.string().min(1),
      employeeId: z
        .string()
        .nullable()
        .transform((v) => (v === "" || v === "none" ? null : v)),
    })
    .strict(),
  audit: { action: "UPDATE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await linkUserEmployee(ctx, input);
    audit.record({
      entityId: input.userId,
      summary: result.after.employeeNo
        ? `Linked ${result.user.name} to employee ${result.after.employeeNo}`
        : `Unlinked ${result.user.name} from employee ${result.before.employeeNo ?? "—"}`,
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
  schema: z.object({ userId: z.string().min(1), permissionKey: z.string().min(1) }).strict(),
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

// --- Creating users and roles ------------------------------------------------

/**
 * A temporary password still has to be a real one.
 *
 * Deliberately the SAME rule as changePasswordSchema — length only, 12 to 128,
 * no composition requirements. Length beats composition (docs/SECURITY.md §2),
 * and a stricter rule here would be worse than useless: it would reject
 * passphrases the user is then free to choose the moment they sign in, so the
 * create form would enforce a policy the system does not actually hold.
 */
const temporaryPassword = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Use at most 128 characters");

export const createUserAction = defineAction({
  permission: "users.manage",
  schema: z
    .object({
      email: z.string().trim().email("Enter a valid email").max(200),
      name: z.string().trim().min(2, "Name is required").max(150),
      roleId: z.string().min(1, "Role is required"),
      temporaryPassword,
      companyIds: z.array(z.string().min(1)).default([]),
      employeeId: z
        .string()
        .optional()
        .transform((v) => (v === "" || v === "none" ? undefined : v)),
    })
    .strict(),
  audit: { action: "CREATE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const user = await createUser(ctx, input);
    audit.record({
      entityId: user.id,
      // The password is deliberately absent from the audit record, as it is
      // from the logs and the response — SECURITY.md §39.
      summary: `Created user ${user.email} with role ${user.roleKey}`,
      after: { email: user.email, name: user.name, roleKey: user.roleKey },
    });
    return { id: user.id };
  },
  revalidate: () => ["/settings/users"],
});

export const createRoleAction = defineAction({
  permission: "roles.manage",
  schema: z
    .object({
      key: z
        .string()
        .trim()
        .min(2, "At least 2 characters")
        .max(40)
        .regex(/^[A-Za-z0-9_]+$/, "Letters, digits, and underscores only"),
      name: z.string().trim().min(2, "Name is required").max(100),
      description: z
        .string()
        .trim()
        .max(300)
        .optional()
        .transform((v) => (v === "" ? undefined : v)),
      rank: z.coerce.number().int("Whole numbers only").min(1, "Rank starts at 1").max(999),
    })
    .strict(),
  audit: { action: "CREATE", entity: "ROLE" },
  handler: async ({ input, ctx, audit }) => {
    const role = await createRole(ctx, input);
    audit.record({
      entityId: role.id,
      summary: `Created role ${role.key} (${role.name}) at rank ${String(role.rank)}`,
      after: { key: role.key, name: role.name, rank: role.rank },
    });
    return { id: role.id };
  },
  revalidate: () => ["/settings/roles", "/settings/users"],
});

export const deleteRoleAction = defineAction({
  permission: "roles.manage",
  schema: z.object({ roleId: z.string().min(1) }).strict(),
  audit: { action: "DELETE", entity: "ROLE" },
  handler: async ({ input, ctx, audit }) => {
    const role = await deleteRole(ctx, input.roleId);
    audit.record({
      entityId: input.roleId,
      summary: `Deleted role ${role.key} (${role.name})`,
      before: { key: role.key, name: role.name },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/settings/roles", "/settings/users"],
});
