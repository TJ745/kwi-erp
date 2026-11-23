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
import { hashPassword } from "@/server/auth/password";
import { isPermissionKey, SUPER_ADMIN_ROLE_KEY } from "@/lib/permissions";

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
  /**
   * Sees every company regardless of the access list: a super admin, or a
   * role (or override) granting companies.viewAll. Their list is not used.
   */
  allCompanies: boolean;
  /** The employee record this account belongs to, if any. */
  employee: { id: string; fullName: string; employeeNo: string } | null;
  /** Active overrides, so the row can show that this user is not just their role. */
  overrides: { key: string; label: string; effect: string; expiresAt: Date | null }[];
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
        role: {
          select: {
            key: true,
            name: true,
            permissions: {
              where: { permission: { key: "companies.viewAll" } },
              select: { roleId: true },
            },
          },
        },
        _count: { select: { companyAccess: true } },
        employee: { select: { id: true, fullName: true, employeeNo: true } },
        overrides: {
          select: {
            effect: true,
            expiresAt: true,
            permission: { select: { key: true, label: true } },
          },
        },
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
      allCompanies:
        u.role.key === SUPER_ADMIN_ROLE_KEY ||
        (u.role.permissions.length > 0 &&
          !u.overrides.some(
            (o) =>
              o.permission.key === "companies.viewAll" &&
              o.effect === "DENY" &&
              (o.expiresAt === null || o.expiresAt > new Date()),
          )) ||
        u.overrides.some(
          (o) =>
            o.permission.key === "companies.viewAll" &&
            o.effect === "ALLOW" &&
            (o.expiresAt === null || o.expiresAt > new Date()),
        ),
      employee: u.employee,
      overrides: u.overrides.map((o) => ({
        key: o.permission.key,
        label: o.permission.label,
        effect: o.effect,
        expiresAt: o.expiresAt,
      })),
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
export async function updateUserRole(ctx: ActorContext, input: { userId: string; roleId: string }) {
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
  const missing = input.permissionKeys.filter((key) => !ctx.permissions.has(key as never));
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

/** Active users for a picker (vault grants). Names and emails only. */
export async function activeUserOptions() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, email: true },
  });
}

// --- Per-user permission overrides -------------------------------------------

/**
 * Grants or denies a single permission for one user, on top of their role.
 *
 * The resolver in `server/auth/context.ts` has always honoured these rows
 * (GRANT wins, DENY wins over the role, expired rows are ignored) — but nothing
 * could create one, so the feature was half-built: enforcement without
 * administration.
 *
 * Three escalation guards, all required:
 *   1. The actor may not modify a user at or above their own seniority.
 *   2. The actor may not modify themselves — otherwise `users.manage` alone is
 *      a route to every other permission in the system.
 *   3. The actor may not ALLOW a permission they do not themselves hold. This
 *      is the important one: without it, an ADMIN holding `users.manage` could
 *      hand out `vault.reveal`, which no ADMIN is ever meant to have.
 *
 * A DENY is deliberately not covered by (3): taking a permission away from
 * someone is not an escalation, and an actor may legitimately need to restrict
 * access they cannot themselves use.
 */
export async function setUserPermissionOverride(
  ctx: ActorContext,
  input: {
    userId: string;
    permissionKey: string;
    effect: "ALLOW" | "DENY";
    expiresAt?: Date | undefined;
    reason?: string | undefined;
  },
) {
  const [target, permission] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true, name: true, email: true, role: { select: { rank: true } } },
    }),
    prisma.permission.findUnique({
      where: { key: input.permissionKey },
      select: { id: true, key: true, label: true },
    }),
  ]);

  if (!target) throw new NotFoundError("User not found.");
  if (!permission) throw new NotFoundError("Permission not found.");

  requireSeniorTo(ctx, target.role.rank);

  if (ctx.userId === input.userId) {
    throw new ForbiddenError("You cannot change your own permissions.");
  }

  if (!isPermissionKey(permission.key)) {
    // A row that outlived its catalogue entry cannot be reasoned about, so it
    // is not handed out — narrowing here also removes the need for a cast.
    throw new NotFoundError("Permission not found.");
  }

  if (input.effect === "ALLOW" && !ctx.permissions.has(permission.key)) {
    throw new ForbiddenError("You cannot grant a permission you do not hold yourself.");
  }

  const existing = await prisma.userPermission.findUnique({
    where: { userId_permissionId: { userId: target.id, permissionId: permission.id } },
    select: { effect: true, expiresAt: true },
  });

  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId: target.id, permissionId: permission.id } },
    create: {
      userId: target.id,
      permissionId: permission.id,
      effect: input.effect,
      grantedById: ctx.userId,
      expiresAt: input.expiresAt ?? null,
      reason: input.reason ?? null,
    },
    update: {
      effect: input.effect,
      grantedById: ctx.userId,
      expiresAt: input.expiresAt ?? null,
      reason: input.reason ?? null,
    },
  });

  return {
    user: target,
    permission,
    before: existing
      ? { effect: existing.effect, expiresAt: existing.expiresAt }
      : { effect: null, expiresAt: null },
    after: { effect: input.effect, expiresAt: input.expiresAt ?? null },
  };
}

/** Removes an override, returning the user to whatever their role grants. */
export async function removeUserPermissionOverride(
  ctx: ActorContext,
  input: { userId: string; permissionKey: string },
) {
  const [target, permission] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true, name: true, email: true, role: { select: { rank: true } } },
    }),
    prisma.permission.findUnique({
      where: { key: input.permissionKey },
      select: { id: true, key: true, label: true },
    }),
  ]);

  if (!target) throw new NotFoundError("User not found.");
  if (!permission) throw new NotFoundError("Permission not found.");

  requireSeniorTo(ctx, target.role.rank);

  if (ctx.userId === input.userId) {
    throw new ForbiddenError("You cannot change your own permissions.");
  }

  const existing = await prisma.userPermission.findUnique({
    where: { userId_permissionId: { userId: target.id, permissionId: permission.id } },
    select: { effect: true },
  });
  if (!existing) throw new NotFoundError("That override does not exist.");

  await prisma.userPermission.delete({
    where: { userId_permissionId: { userId: target.id, permissionId: permission.id } },
  });

  return { user: target, permission, before: { effect: existing.effect } };
}

// --- Creating users and roles ------------------------------------------------

/**
 * Creates a user account with a temporary password.
 *
 * The password is hashed with the same Argon2id profile as every other
 * credential and written to an `Account` row with providerId "credential" —
 * the shape Better Auth expects. `mustChangePassword` is forced on, which the
 * app layout already acts on by redirecting to /change-password, so a password
 * that passed through an administrator cannot survive the first sign-in.
 *
 * Both writes happen in one transaction. A User without its Account is an
 * account nobody can ever sign into and which blocks the email address from
 * being reused — worse than no account at all.
 */
export async function createUser(
  ctx: ActorContext,
  input: {
    email: string;
    name: string;
    roleId: string;
    temporaryPassword: string;
    companyIds: string[];
    employeeId?: string | undefined;
  },
) {
  const email = input.email.trim().toLowerCase();

  const [existing, role] = await Promise.all([
    prisma.user.findFirst({ where: { email }, select: { id: true } }),
    prisma.role.findUnique({
      where: { id: input.roleId },
      select: { id: true, key: true, name: true, rank: true },
    }),
  ]);

  // Checked against soft-deleted rows too: the column is unique, so a
  // deactivated account still owns the address and a clearer error beats a
  // constraint violation.
  if (existing) throw new ConflictError("An account with that email already exists.");
  if (!role) throw new NotFoundError("Role not found.");

  // Nobody may mint an account at or above their own level.
  requireSeniorTo(ctx, role.rank);

  if (input.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null },
      select: { id: true, userAccount: { select: { id: true } } },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
    if (employee.userAccount) {
      throw new ConflictError("That employee already has a user account.");
    }
  }

  const passwordHash = await hashPassword(input.temporaryPassword);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name,
        roleId: role.id,
        status: "ACTIVE",
        // Not verified: nothing has proved the address works. It gates nothing
        // today, and claiming otherwise would make a future email flow lie.
        emailVerified: false,
        mustChangePassword: true,
        ...(input.employeeId ? { employeeId: input.employeeId } : {}),
      },
      select: { id: true, name: true, email: true },
    });

    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });

    if (input.companyIds.length > 0) {
      await tx.userCompanyAccess.createMany({
        data: input.companyIds.map((companyId) => ({ userId: user.id, companyId })),
        skipDuplicates: true,
      });
    }

    return { ...user, roleKey: role.key, roleName: role.name };
  });
}

/**
 * Creates a custom role.
 *
 * `isSystem` is false and never settable from here: a role created through the
 * UI must stay deletable, and letting the UI mint protected roles would let
 * somebody build a role they then could not remove.
 *
 * The new role starts with NO permissions. Granting them is a separate,
 * separately audited step in the role editor — a role that arrived
 * pre-populated would make "who granted this" unanswerable.
 */
export async function createRole(
  ctx: ActorContext,
  input: { key: string; name: string; description?: string | undefined; rank: number },
) {
  const key = input.key.trim().toUpperCase();

  const existing = await prisma.role.findUnique({ where: { key }, select: { id: true } });
  if (existing) throw new ConflictError(`A role with key ${key} already exists.`);

  // Creating a role senior to yourself would hand you a ladder out of your own
  // permission set the moment somebody assigned it to you.
  requireSeniorTo(ctx, input.rank);

  return prisma.role.create({
    data: {
      key,
      name: input.name,
      description: input.description ?? null,
      rank: input.rank,
      isSystem: false,
    },
    select: { id: true, key: true, name: true, rank: true },
  });
}

/**
 * Deletes a custom role.
 *
 * Refused for system roles and for any role that still has users: `User.roleId`
 * is required, so removing a role in use would either orphan those accounts or
 * silently move them somewhere they were never assigned.
 */
export async function deleteRole(ctx: ActorContext, roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      key: true,
      name: true,
      rank: true,
      isSystem: true,
      _count: { select: { users: true } },
    },
  });
  if (!role) throw new NotFoundError("Role not found.");

  if (role.isSystem) {
    throw new ForbiddenError("Built-in roles cannot be deleted.");
  }
  requireSeniorTo(ctx, role.rank);

  if (role._count.users > 0) {
    throw new ConflictError(
      `${String(role._count.users)} user(s) still have this role. Move them to another role first.`,
    );
  }

  // Grants go with it; nothing else references a role.
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.role.delete({ where: { id: roleId } }),
  ]);

  return { key: role.key, name: role.name };
}

/**
 * Links an existing account to an employee record, or unlinks it (null).
 *
 * The same seniority rule as every other change to a user: only someone
 * senior to the account may relink it. The one exception is a super admin
 * linking their own account — nobody outranks them, and an account set up
 * before the employee existed (the first admin) would otherwise never be
 * linkable.
 */
export async function linkUserEmployee(
  ctx: ActorContext,
  input: { userId: string; employeeId: string | null },
) {
  const target = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      role: { select: { rank: true } },
      employee: { select: { employeeNo: true } },
    },
  });
  if (!target) throw new NotFoundError("User not found.");

  if (ctx.userId === target.id) {
    if (ctx.roleKey !== SUPER_ADMIN_ROLE_KEY) {
      throw new ForbiddenError("Only a super admin can link their own account.");
    }
  } else {
    requireSeniorTo(ctx, target.role.rank);
  }

  let employeeNo: string | null = null;
  if (input.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null },
      select: { employeeNo: true, userAccount: { select: { id: true } } },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
    if (employee.userAccount && employee.userAccount.id !== target.id) {
      throw new ConflictError("That employee already has a user account.");
    }
    employeeNo = employee.employeeNo;
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { employeeId: input.employeeId },
  });

  return {
    user: target,
    before: { employeeNo: target.employee?.employeeNo ?? null },
    after: { employeeNo },
  };
}

/** Employees with no user account yet, for the optional link on the create form. */
export async function employeesWithoutUser(ctx: ActorContext) {
  void ctx;
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      userAccount: { is: null },
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, employeeNo: true },
  });
}
