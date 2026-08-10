import "server-only";
import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/permissions";
import { getActorContext, type ActorContext } from "./context";

/**
 * Page-level guards.
 *
 * Server Actions use requirePermission() from guards.ts, which THROWS so the
 * defineAction pipeline can turn it into a typed ActionResult.
 *
 * Pages need different behaviour: an uncaught throw renders a 500 error
 * boundary, which tells the user "something crashed" when the truth is "you do
 * not have access". These redirect to a real page instead.
 *
 * Both paths are equally strict — this only changes presentation.
 */

export async function requirePageAuth(): Promise<ActorContext> {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requirePagePermission(key: PermissionKey): Promise<ActorContext> {
  const ctx = await requirePageAuth();
  if (!ctx.permissions.has(key)) redirect("/no-access");
  return ctx;
}

export async function requirePageAnyPermission(
  keys: readonly PermissionKey[],
): Promise<ActorContext> {
  const ctx = await requirePageAuth();
  if (!keys.some((key) => ctx.permissions.has(key))) redirect("/no-access");
  return ctx;
}
