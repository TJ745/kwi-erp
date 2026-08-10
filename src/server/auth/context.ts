import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { resolvePermissions, type PermissionKey } from "@/lib/permissions";
import { prisma } from "@/server/db/client";
import { auth } from "./auth";

/**
 * The ONLY identity object services accept — docs/SECURITY.md §3.
 *
 * Services never read the session themselves, so a service cannot accidentally
 * run unauthenticated: there is no ambient identity to fall back on.
 */
export type ActorContext = {
  userId: string;
  email: string;
  name: string;
  roleKey: string;
  roleRank: number;
  permissions: ReadonlySet<PermissionKey>;
  /** Company ids the actor may touch, or "ALL" via companies.viewAll. */
  companyScope: readonly string[] | "ALL";
  /** Linked employee record, when the user is also an employee. */
  employeeId: string | null;
  /** Departments the actor manages, or "ALL". Populated for MANAGER scoping. */
  departmentScope: readonly string[] | "ALL";
  mustChangePassword: boolean;
  ipAddress: string | null;
  userAgent: string | null;
};

/** SUPER_ADMIN short-circuits every permission check. */
const SUPER_ADMIN_ROLE_KEY = "SUPER_ADMIN";

/**
 * Resolves the current actor, or null when unauthenticated.
 *
 * Wrapped in React `cache()` so repeated guard calls within one render cost a
 * single set of queries.
 */
export const getActorContext = cache(async (): Promise<ActorContext | null> => {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  if (!session?.user) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      employeeId: true,
      mustChangePassword: true,
      lockedUntil: true,
      role: {
        select: {
          key: true,
          rank: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      overrides: {
        select: {
          effect: true,
          expiresAt: true,
          permission: { select: { key: true } },
        },
      },
      companyAccess: { select: { companyId: true } },
    },
  });

  // A disabled or locked account must not resolve, even with a valid cookie.
  if (!user || user.status !== "ACTIVE") return null;
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;

  const permissions = resolvePermissions({
    rolePermissions: user.role.permissions.map((rp) => rp.permission.key),
    overrides: user.overrides.map((o) => ({
      key: o.permission.key,
      effect: o.effect,
      expiresAt: o.expiresAt,
    })),
    isSuperAdmin: user.role.key === SUPER_ADMIN_ROLE_KEY,
  });

  const companyScope: readonly string[] | "ALL" = permissions.has("companies.viewAll")
    ? "ALL"
    : user.companyAccess.map((a) => a.companyId);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleKey: user.role.key,
    roleRank: user.role.rank,
    permissions,
    companyScope,
    employeeId: user.employeeId,
    departmentScope: await resolveDepartmentScope(user.role.key, user.employeeId),
    mustChangePassword: user.mustChangePassword,
    ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  };
});

/**
 * Managers are scoped to their own department subtree; everyone else is
 * governed by permissions alone.
 */
async function resolveDepartmentScope(
  roleKey: string,
  employeeId: string | null,
): Promise<readonly string[] | "ALL"> {
  if (roleKey !== "MANAGER" || !employeeId) return "ALL";

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true },
  });
  if (!employee?.departmentId) return [];

  // Walk down the department tree. Depth is small (2-3 in practice), so an
  // iterative expansion is cheaper and clearer than a recursive CTE here.
  const scope = new Set<string>([employee.departmentId]);
  let frontier = [employee.departmentId];

  for (let depth = 0; depth < 5 && frontier.length > 0; depth += 1) {
    const children = await prisma.department.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !scope.has(id));
    for (const id of frontier) scope.add(id);
  }

  return [...scope];
}
