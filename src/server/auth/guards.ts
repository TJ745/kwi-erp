import "server-only";
import type { PermissionKey } from "@/lib/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/result";
import { getActorContext, type ActorContext } from "./context";

/**
 * The three gates every request passes — docs/SECURITY.md §3.
 * Failing any one denies. Gate 3 (scope) is the one most systems forget.
 */

export async function requireAuth(): Promise<ActorContext> {
  const ctx = await getActorContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}

export async function requirePermission(key: PermissionKey): Promise<ActorContext> {
  const ctx = await requireAuth();
  if (!ctx.permissions.has(key)) throw new ForbiddenError();
  return ctx;
}

export async function requireAnyPermission(keys: readonly PermissionKey[]): Promise<ActorContext> {
  const ctx = await requireAuth();
  if (!keys.some((key) => ctx.permissions.has(key))) throw new ForbiddenError();
  return ctx;
}

export async function requireAllPermissions(keys: readonly PermissionKey[]): Promise<ActorContext> {
  const ctx = await requireAuth();
  if (!keys.every((key) => ctx.permissions.has(key))) throw new ForbiddenError();
  return ctx;
}

/** Non-throwing check, for conditionally rendering UI affordances. */
export function can(ctx: ActorContext | null, key: PermissionKey): boolean {
  return ctx?.permissions.has(key) ?? false;
}

// --- Company scoping ---------------------------------------------------------

/**
 * Throws unless the actor may act on this company.
 *
 * Deliberately reports "not found" rather than "forbidden" so that record
 * existence in another company cannot be probed.
 */
export function requireCompanyAccess(ctx: ActorContext, companyId: string): void {
  if (ctx.companyScope === "ALL") return;
  if (!ctx.companyScope.includes(companyId)) throw new ForbiddenError("Record not found.");
}

export function hasCompanyAccess(ctx: ActorContext, companyId: string): boolean {
  return ctx.companyScope === "ALL" || ctx.companyScope.includes(companyId);
}

/**
 * The scope fragment to spread into EVERY query on a company-owned table.
 *
 *   const where = { ...filters, ...companyScopeWhere(ctx) };
 *
 * Applying scope in the query — not by filtering results afterwards — is what
 * keeps counts and pagination correct and prevents row-count leakage.
 * Review rule: a findMany on a company-owned table without this is rejected.
 */
export function companyScopeWhere(ctx: ActorContext): { companyId?: { in: string[] } } {
  if (ctx.companyScope === "ALL") return {};
  return { companyId: { in: [...ctx.companyScope] } };
}

/**
 * Same, for tables where the company link is nullable (Position, Supplier,
 * LetterTemplate): rows with no company are shared and remain visible.
 */
export function optionalCompanyScopeWhere(ctx: ActorContext): {
  OR?: ({ companyId: { in: string[] } } | { companyId: null })[];
} {
  if (ctx.companyScope === "ALL") return {};
  return { OR: [{ companyId: { in: [...ctx.companyScope] } }, { companyId: null }] };
}

/** The company to use when the caller did not specify one. */
export function defaultCompanyId(ctx: ActorContext): string | null {
  if (ctx.companyScope === "ALL") return null;
  return ctx.companyScope[0] ?? null;
}

// --- Department scoping ------------------------------------------------------

export function departmentScopeWhere(ctx: ActorContext): { departmentId?: { in: string[] } } {
  if (ctx.departmentScope === "ALL") return {};
  return { departmentId: { in: [...ctx.departmentScope] } };
}

// --- Role seniority ----------------------------------------------------------

/**
 * Prevents privilege escalation through the role editor: an actor may never
 * grant or edit a role at least as senior as their own.
 */
export function requireSeniorTo(ctx: ActorContext, targetRoleRank: number): void {
  if (ctx.roleRank >= targetRoleRank) {
    throw new ForbiddenError("You cannot modify a role at or above your own level.");
  }
}
