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
