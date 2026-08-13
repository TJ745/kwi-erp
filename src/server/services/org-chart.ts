import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";

/**
 * Organisation chart — brief §13.
 *
 * Built from `Employee.managerId`, which is self-referential and therefore able
 * to contain a cycle: A reports to B reports to A. The database does not
 * prevent it, so the builder must, or rendering the tree recurses until the
 * stack gives out.
 */

export type OrgNode = {
  id: string;
  fullName: string;
  employeeNo: string;
  positionTitle: string | null;
  departmentName: string | null;
  companyCode: string;
  status: string;
  reports: OrgNode[];
};

export type OrgChart = {
  roots: OrgNode[];
  /** Employees dropped because following their manager led back to themselves. */
  cycles: { id: string; fullName: string; employeeNo: string }[];
  total: number;
};

export async function buildOrgChart(
  ctx: ActorContext,
  filters: { companyId?: string | undefined } = {},
): Promise<OrgChart> {
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      ...companyScopeWhere(ctx),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
    },
    orderBy: { fullName: "asc" },
    take: 2000,
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      managerId: true,
      status: true,
      position: { select: { title: true } },
      department: { select: { name: true } },
      company: { select: { code: true } },
    },
  });

  const nodes = new Map<string, OrgNode>();
  for (const e of employees) {
    nodes.set(e.id, {
      id: e.id,
      fullName: e.fullName,
      employeeNo: e.employeeNo,
      positionTitle: e.position?.title ?? null,
      departmentName: e.department?.name ?? null,
      companyCode: e.company.code,
      status: e.status,
      reports: [],
    });
  }

  const cycles: OrgChart["cycles"] = [];
  const roots: OrgNode[] = [];

  /**
   * Walks up the management chain looking for the employee we started from.
   * Bounded by the node count as well, so a chain that is merely very deep
   * cannot spin either.
   */
  function reachesItself(startId: string, managerId: string | null): boolean {
    let cursor = managerId;
    let hops = 0;
    while (cursor !== null && hops <= nodes.size) {
      if (cursor === startId) return true;
      cursor = employees.find((e) => e.id === cursor)?.managerId ?? null;
      hops += 1;
    }
    return false;
  }

  for (const e of employees) {
    const node = nodes.get(e.id);
    if (!node) continue;

    // No manager, or a manager outside the visible set (another company, or
    // someone who has left) — either way this person is a root of what we can
    // actually see.
    const manager = e.managerId ? nodes.get(e.managerId) : undefined;
    if (!manager) {
      roots.push(node);
      continue;
    }

    if (reachesItself(e.id, e.managerId)) {
      // Attaching this would build a loop. Reported rather than hidden: a
      // reporting cycle is a data error somebody needs to fix.
      cycles.push({ id: e.id, fullName: e.fullName, employeeNo: e.employeeNo });
      roots.push(node);
      continue;
    }

    manager.reports.push(node);
  }

  return { roots, cycles, total: employees.length };
}

/** Flattened counts for the header. */
export function orgChartStats(chart: OrgChart): {
  roots: number;
  managers: number;
  deepest: number;
} {
  let managers = 0;
  let deepest = 0;

  const walk = (node: OrgNode, depth: number): void => {
    if (node.reports.length > 0) managers += 1;
    deepest = Math.max(deepest, depth);
    for (const child of node.reports) walk(child, depth + 1);
  };

  for (const root of chart.roots) walk(root, 1);
  return { roots: chart.roots.length, managers, deepest };
}
