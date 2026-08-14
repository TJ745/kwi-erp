import "server-only";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { businessStartOfDay, expiryCutoff } from "@/lib/expiry";

/**
 * Dashboard aggregates.
 *
 * Lives in the service layer rather than the page, so the page stays free of
 * Prisma (docs/ARCHITECTURE.md §4) and every count is company-scoped in one
 * place instead of at each call site.
 */

export type DashboardKpis = {
  totalEmployees: number;
  activeEmployees: number;
  expiredDocuments: number;
  expiringIn30Days: number;
};

export async function dashboardKpis(ctx: ActorContext): Promise<DashboardKpis> {
  const canViewEmployees = ctx.permissions.has("employees.view");

  // Computed once, outside the render path, and shared by both expiry queries
  // so the two counts cannot straddle a clock tick.
  const now = new Date();
  const todayStart = businessStartOfDay(now);
  const in30Days = expiryCutoff(30, now);

  const scope = companyScopeWhere(ctx);

  const [totalEmployees, activeEmployees, expiredDocuments, expiringIn30Days] =
    await Promise.all([
      canViewEmployees ? prisma.employee.count({ where: scope }) : Promise.resolve(0),
      canViewEmployees
        ? prisma.employee.count({ where: { status: "ACTIVE", ...scope } })
        : Promise.resolve(0),
      prisma.expiryIndex.count({
        where: { isActive: true, expiryDate: { lt: todayStart }, ...scope },
      }),
      prisma.expiryIndex.count({
        where: {
          isActive: true,
          expiryDate: { gte: todayStart, lte: in30Days },
          ...scope,
        },
      }),
    ]);

  return { totalEmployees, activeEmployees, expiredDocuments, expiringIn30Days };
}

/**
 * What is waiting on somebody, across the modules that have an approval step.
 *
 * Each count is gated on the permission that would let the actor act on it: a
 * queue you cannot clear is not a call to action, it is noise. Counts only —
 * the rows live on their own pages, and fetching them here would duplicate
 * five services' scoping rules on the dashboard.
 */
export type PendingWork = {
  pettyCash: number;
  leave: number;
  increments: number;
  openTickets: number;
  maintenanceDue: number;
  onboarding: number;
  offboarding: number;
};

export async function pendingWork(ctx: ActorContext): Promise<PendingWork> {
  const now = new Date();
  const scope = companyScopeWhere(ctx);
  const has = (key: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(key);

  const [pettyCash, leave, increments, openTickets, maintenanceDue, onboarding, offboarding] =
    await Promise.all([
      has("pettycash.approve")
        ? prisma.pettyCashTransaction.count({ where: { status: "PENDING", ...scope } })
        : Promise.resolve(0),

      has("hr.leave.approve")
        ? prisma.leaveRequest.count({
            where: { status: "PENDING", employee: { ...scope, deletedAt: null } },
          })
        : Promise.resolve(0),

      has("hr.increments.approve")
        ? prisma.increment.count({
            where: { status: "PENDING", employee: { ...scope, deletedAt: null } },
          })
        : Promise.resolve(0),

      has("it.tickets.view")
        ? prisma.iTTicket.count({
            where: { status: { notIn: ["RESOLVED", "CLOSED"] }, ...scope },
          })
        : Promise.resolve(0),

      // Maintenance has no "scheduled" state — its status is an approval
      // status. What matters operationally is the next service falling due,
      // so that is what is counted: due within 30 days, or already past.
      has("vehicles.maintenance.view")
        ? prisma.vehicleMaintenance.count({
            where: {
              status: { not: "CANCELLED" },
              nextDueDate: { not: null, lte: expiryCutoff(30, now) },
              vehicle: scope,
            },
          })
        : Promise.resolve(0),

      has("hr.onboarding.view")
        ? prisma.checklistInstance.count({
            where: { type: "ONBOARDING", status: "IN_PROGRESS", ...scope },
          })
        : Promise.resolve(0),

      has("hr.offboarding.view")
        ? prisma.checklistInstance.count({
            where: { type: { not: "ONBOARDING" }, status: "IN_PROGRESS", ...scope },
          })
        : Promise.resolve(0),
    ]);

  return {
    pettyCash,
    leave,
    increments,
    openTickets,
    maintenanceDue,
    onboarding,
    offboarding,
  };
}
