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
  /** An unfilled budgeted seat rather than a person. Never links anywhere. */
  vacant?: boolean;
  reports: OrgNode[];
};

export type OrgChart = {
  roots: OrgNode[];
  /** Employees dropped because following their manager led back to themselves. */
  cycles: { id: string; fullName: string; employeeNo: string }[];
  total: number;
  /** Unfilled budgeted seats drawn into the tree. */
  vacancies: number;
  /**
   * Budgeted roles that are wholly unfilled AND have no place in the designed
   * structure, so there is nowhere to draw them. Surfaced rather than dropped:
   * silently omitting a vacant seat defeats the point of charting vacancies.
   */
  unplaced: { positionTitle: string; companyCode: string | null; seats: number }[];
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

  const { vacancies, unplaced } = await attachVacancies(ctx, filters, nodes, roots);

  return { roots, cycles, total: employees.length, vacancies, unplaced };
}

/**
 * Draws budgeted-but-unfilled seats into the tree.
 *
 * A chart that only shows people cannot show a gap, and a gap is usually the
 * most interesting thing on an org chart — it is the hire that has not
 * happened. A seat is vacant when a position budgets more headcount than it
 * currently has holders.
 *
 * Placement, in order of preference:
 *   1. under the manager its existing holders report to — if three of four
 *      carpenters report to the foreman, the fourth seat belongs there too;
 *   2. under a holder of the role named by `reportsToPositionId` — the only
 *      thing that can place a role with NO holders at all;
 *   3. nowhere, in which case it is returned as `unplaced` and reported.
 */
async function attachVacancies(
  ctx: ActorContext,
  filters: { companyId?: string | undefined },
  nodes: Map<string, OrgNode>,
  roots: OrgNode[],
): Promise<{ vacancies: number; unplaced: OrgChart["unplaced"] }> {
  const positions = await prisma.position.findMany({
    where: {
      status: "ACTIVE",
      budgetedHeadcount: { gt: 0 },
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
    },
    select: {
      id: true,
      title: true,
      budgetedHeadcount: true,
      reportsToPositionId: true,
      company: { select: { code: true } },
      employees: {
        where: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
        select: { id: true, managerId: true },
      },
    },
  });

  // Which node holds which position, so `reportsToPositionId` can be resolved
  // to somewhere in the tree that actually exists.
  const holdersOfPosition = new Map<string, string[]>();
  for (const position of positions) {
    holdersOfPosition.set(
      position.id,
      position.employees.map((e) => e.id).filter((id) => nodes.has(id)),
    );
  }

  let vacancies = 0;
  const unplaced: OrgChart["unplaced"] = [];
  let counter = 0;

  for (const position of positions) {
    const visibleHolders = position.employees.filter((e) => nodes.has(e.id));
    const seats = position.budgetedHeadcount - visibleHolders.length;
    if (seats <= 0) continue;

    // (1) the manager the existing holders report to
    let parent: OrgNode | undefined;
    for (const holder of visibleHolders) {
      const manager = holder.managerId ? nodes.get(holder.managerId) : undefined;
      if (manager) {
        parent = manager;
        break;
      }
    }

    // (2) somebody holding the position this role reports to
    if (!parent && position.reportsToPositionId) {
      for (const holderId of holdersOfPosition.get(position.reportsToPositionId) ?? []) {
        const candidate = nodes.get(holderId);
        if (candidate) {
          parent = candidate;
          break;
        }
      }
    }

    if (!parent) {
      // (3) nowhere to put it — say so rather than lose it.
      unplaced.push({
        positionTitle: position.title,
        companyCode: position.company?.code ?? null,
        seats,
      });
      continue;
    }

    for (let i = 0; i < seats; i += 1) {
      counter += 1;
      parent.reports.push({
        // Synthetic and clearly not an employee id — nothing may link to it.
        id: `vacant:${position.id}:${String(counter)}`,
        fullName: "Vacant",
        employeeNo: "",
        positionTitle: position.title,
        departmentName: null,
        companyCode: position.company?.code ?? "—",
        status: "VACANT",
        vacant: true,
        reports: [],
      });
      vacancies += 1;
    }
  }

  void ctx;
  void roots;
  return { vacancies, unplaced };
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
