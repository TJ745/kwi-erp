import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere } from "@/server/auth/guards";
import { buildPositionTree, type ChartPosition } from "@/lib/position-chart";

/**
 * Organization chart, by position: each job title along its "reports to"
 * line (set on the position in Settings → Departments), with the active
 * employees holding it underneath.
 */
export async function positionChart(ctx: ActorContext, companyIds: string[] = []) {
  const companies = await prisma.company.findMany({
    where: ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, headerImageFileId: true },
  });
  const chosen = companyIds.length ? companies.filter((c) => companyIds.includes(c.id)) : companies;
  const chosenIds = chosen.map((c) => c.id);

  const [positions, employees, unplaced] = await Promise.all([
    prisma.position.findMany({
      where: {
        status: "ACTIVE",
        // Both are OR conditions: side by side the second would replace the first.
        AND: [
          optionalCompanyScopeWhere(ctx),
          { OR: [{ companyId: null }, { companyId: { in: chosenIds } }] },
        ],
      },
      select: { id: true, title: true, reportsToPositionId: true, budgetedHeadcount: true },
    }),
    prisma.employee.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
        companyId: { in: chosenIds },
        positionId: { not: null },
        ...companyScopeWhere(ctx),
      },
      select: {
        fullName: true,
        nationality: true,
        positionId: true,
        company: { select: { code: true } },
      },
    }),
    // Active employees with no position cannot be drawn; they are counted.
    prisma.employee.count({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
        companyId: { in: chosenIds },
        positionId: null,
      },
    }),
  ]);

  const peopleBy = new Map<string, ChartPosition["people"]>();
  const totals = new Map<string, number>();
  for (const e of employees) {
    if (!e.positionId) continue;
    const list = peopleBy.get(e.positionId) ?? [];
    list.push({ name: e.fullName, companyCode: e.company.code, saudi: e.nationality === "SA" });
    peopleBy.set(e.positionId, list);
    totals.set(e.company.code, (totals.get(e.company.code) ?? 0) + 1);
  }

  const tree = buildPositionTree(
    positions.map((p) => ({
      id: p.id,
      title: p.title,
      reportsToId: p.reportsToPositionId,
      budgeted: p.budgetedHeadcount,
      people: peopleBy.get(p.id) ?? [],
    })),
  );

  return {
    tree,
    companies,
    chosen,
    totals: chosen.map((c) => ({ code: c.code, count: totals.get(c.code) ?? 0 })),
    total: employees.length,
    unplaced,
  };
}
