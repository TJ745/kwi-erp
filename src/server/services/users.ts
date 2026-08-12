import "server-only";
import type { ActorContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import { requireSeniorTo } from "@/server/auth/guards";

/**
 * User administration.
 *
 * Services take `ctx` explicitly and never read the session, so they cannot
 * run unauthenticated (docs/ARCHITECTURE.md §4).
 */

const SORTABLE = ["name", "email", "createdAt", "lastLoginAt"] as const;

export type UserListRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  mustChangePassword: boolean;
  roleKey: string;
  roleName: string;
  companyCount: number;
};

export async function listUsers(
  ctx: ActorContext,
  query: ListQuery,
): Promise<Paginated<UserListRow>> {
  void ctx; // Authorisation is the caller's gate; users are not company-scoped.

  const sort = parseSort(query.sort, SORTABLE, { field: "name", direction: "asc" });

  const where = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" as const } },
          { email: { contains: query.q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { [sort.field]: sort.direction },
      ...paginationFor(query),
      // Explicit select: never return the whole entity (docs/SECURITY.md §4).
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        mustChangePassword: true,
        role: { select: { key: true, name: true } },
        _count: { select: { companyAccess: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return paginate(
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      mustChangePassword: u.mustChangePassword,
      roleKey: u.role.key,
      roleName: u.role.name,
      companyCount: u._count.companyAccess,
    })),
    total,
    query,
  );
}

export async function getUserForEdit(ctx: ActorContext, userId: string) {
  void ctx;

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mustChangePassword: true,
      role: { select: { id: true, key: true, name: true, rank: true } },
      companyAccess: { select: { companyId: true } },
      overrides: {
        select: {
          effect: true,
          expiresAt: true,
          permission: { select: { key: true, label: true } },
        },
      },
    },
  });

  if (!user) throw new NotFoundError("User not found.");
  return user;
}

/**
 * Changes a user's role.
 *
 * Two escalation guards, both required:
 *   1. The actor may not assign a role at or above their own seniority.
 *   2. The actor may not modify a user who already outranks them.
 * Without (2), an ADMIN could demote a SUPER_ADMIN and take over.
 */
export async function updateUserRole(
  ctx: ActorContext,
  input: { userId: string; roleId: string },
) {
  const [target, newRole] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true, name: true, email: true, role: { select: { rank: true, key: true } } },
    }),
    prisma.role.findUnique({
      where: { id: input.roleId },
      select: { id: true, key: true, name: true, rank: true },
    }),
  ]);

  if (!target) throw new NotFoundError("User not found.");
  if (!newRole) throw new NotFoundError("Role not found.");

  requireSeniorTo(ctx, target.role.rank);
  requireSeniorTo(ctx, newRole.rank);

  if (ctx.userId === input.userId) {
    throw new ForbiddenError("You cannot change your own role.");
  }

  const before = { roleKey: target.role.key };
  await prisma.user.update({ where: { id: input.userId }, data: { roleId: newRole.id } });

  return {
    user: target,
    before,
    after: { roleKey: newRole.key },
  };
}

export async function updateUserStatus(
  ctx: ActorContext,
  input: { userId: string; status: "ACTIVE" | "SUSPENDED" | "DISABLED" },
) {
  const target = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true, name: true, email: true, status: true, role: { select: { rank: true } } },
  });
  if (!target) throw new NotFoundError("User not found.");

  requireSeniorTo(ctx, target.role.rank);

  if (ctx.userId === input.userId) {
    throw new ForbiddenError("You cannot change your own account status.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: input.userId }, data: { status: input.status } });

    // Deactivating must revoke sessions immediately, or the user keeps working
    // until their cookie happens to expire.
    if (input.status !== "ACTIVE") {
      await tx.session.deleteMany({ where: { userId: input.userId } });
      await tx.vaultSession.deleteMany({ where: { userId: input.userId } });
    }
  });

  return { user: target, before: { status: target.status }, after: { status: input.status } };
}

export async function setUserCompanyAccess(
  ctx: ActorContext,
  input: { userId: string; companyIds: string[] },
) {
  const target = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: { select: { rank: true } } },
  });
  if (!target) throw new NotFoundError("User not found.");
  requireSeniorTo(ctx, target.role.rank);

  // An actor may only grant access to companies they can reach themselves,
  // otherwise scoping could be widened sideways.
  if (ctx.companyScope !== "ALL") {
    const allowed = new Set(ctx.companyScope);
    if (!input.companyIds.every((id) => allowed.has(id))) {
      throw new ForbiddenError("You cannot grant access to a company you do not have.");
    }
  }

  const existing = await prisma.userCompanyAccess.findMany({
    where: { userId: input.userId },
    select: { companyId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.userCompanyAccess.deleteMany({ where: { userId: input.userId } });
    if (input.companyIds.length > 0) {
      await tx.userCompanyAccess.createMany({
        data: input.companyIds.map((companyId) => ({ userId: input.userId, companyId })),
      });
    }
  });

  return {
    user: target,
    before: { companyIds: existing.map((e) => e.companyId).sort() },
    after: { companyIds: [...input.companyIds].sort() },
  };
}

export async function listRolesForAssignment(ctx: ActorContext) {
  return prisma.role.findMany({
    // Only roles the actor is senior to may be assigned.
    where: { rank: { gt: ctx.roleRank } },
    orderBy: { rank: "asc" },
    select: { id: true, key: true, name: true, description: true, rank: true },
  });
}

export async function listCompaniesForAssignment(ctx: ActorContext) {
  return prisma.company.findMany({
    where: {
      deletedAt: null,
      ...(ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } }),
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function listRolesWithPermissionCounts(ctx: ActorContext) {
  void ctx;
  return prisma.role.findMany({
    orderBy: { rank: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      rank: true,
      isSystem: true,
      _count: { select: { permissions: true, users: true } },
    },
  });
}

export async function getRoleWithPermissions(ctx: ActorContext, roleId: string) {
  void ctx;
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      rank: true,
      isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role) throw new NotFoundError("Role not found.");
  return role;
}

/** Replaces a role's permission set wholesale. */
export async function setRolePermissions(
  ctx: ActorContext,
  input: { roleId: string; permissionKeys: string[] },
) {
  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: {
      id: true,
      key: true,
      rank: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role) throw new NotFoundError("Role not found.");

  requireSeniorTo(ctx, role.rank);

  if (role.key === "SUPER_ADMIN") {
    throw new ConflictError("SUPER_ADMIN always holds every permission and cannot be edited.");
  }

  // An actor cannot grant a permission they do not themselves hold — that
  // would let a limited admin bootstrap themselves into the vault.
  const missing = input.permissionKeys.filter(
    (key) => !ctx.permissions.has(key as never),
  );
  if (missing.length > 0) {
    throw new ForbiddenError("You cannot grant a permission you do not hold yourself.");
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: input.permissionKeys } },
    select: { id: true, key: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  });

  return {
    role,
    before: { permissions: role.permissions.map((p) => p.permission.key).sort() },
    after: { permissions: permissions.map((p) => p.key).sort() },
  };
}

/**
 * Maps user ids to display names.
 *
 * `Task.assignedToId` and `ITTicket.requesterId`/`assignedToId` are plain
 * columns with no Prisma relation, so the name cannot come from an `include`.
 * One implementation, used by tasks, helpdesk, and reports — it was copied
 * into two services before reports would have made it three.
 */
export async function resolveUserNames(
  ids: readonly (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}
