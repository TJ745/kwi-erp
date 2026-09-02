import "server-only";
import type { BillStatus } from "@/generated/prisma/enums";
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

/**
 * Expiry outlook, bucketed by urgency.
 *
 * Ordinal by construction — the buckets run nearest to furthest — which is why
 * the chart colours it with a single-hue ramp rather than a categorical set.
 */
export type ExpiryBucket = { label: string; days: number; count: number };

export async function expiryOutlook(ctx: ActorContext): Promise<ExpiryBucket[]> {
  const now = new Date();
  const todayStart = businessStartOfDay(now);
  const scope = companyScopeWhere(ctx);

  const edges = [7, 15, 30, 60, 90];
  const labels = ["≤ 7 days", "8–15", "16–30", "31–60", "61–90"];

  const counts = await Promise.all(
    edges.map((days, index) =>
      prisma.expiryIndex.count({
        where: {
          isActive: true,
          ...scope,
          expiryDate: {
            // Already-expired items are their own KPI; this is the outlook.
            gte: index === 0 ? todayStart : expiryCutoff(edges[index - 1] ?? 0, now),
            lte: expiryCutoff(days, now),
          },
        },
      }),
    ),
  );

  return labels.map((label, i) => ({
    label,
    days: edges[i] ?? 0,
    count: counts[i] ?? 0,
  }));
}

/** Headcount per department — one measure, so one colour and no legend. */
export async function headcountByDepartment(
  ctx: ActorContext,
): Promise<{ name: string; count: number }[]> {
  if (!ctx.permissions.has("employees.view")) return [];

  const grouped = await prisma.employee.groupBy({
    by: ["departmentId"],
    where: { deletedAt: null, status: "ACTIVE", ...companyScopeWhere(ctx) },
    _count: { _all: true },
  });

  const ids = grouped
    .map((g) => g.departmentId)
    .filter((id): id is string => id !== null);

  const departments =
    ids.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, company: { select: { code: true } } },
        })
      : [];

  // Both companies run a department called "Operations". Two bars with the same
  // label are unreadable, so a name shared across companies carries its company
  // code and a unique one stays clean.
  const nameCounts = new Map<string, number>();
  for (const d of departments) {
    nameCounts.set(d.name, (nameCounts.get(d.name) ?? 0) + 1);
  }
  const labelById = new Map(
    departments.map((d) => [
      d.id,
      (nameCounts.get(d.name) ?? 0) > 1 ? `${d.name} · ${d.company.code}` : d.name,
    ]),
  );

  return grouped
    .map((g) => ({
      name: g.departmentId ? (labelById.get(g.departmentId) ?? "Unknown") : "Unassigned",
      count: g._count._all,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  // Deliberately NOT truncated here. The donut folds everything past the top
  // few into "Other", and its centre shows the total — truncating first made
  // that total smaller than the headcount it claimed to be.
}

/**
 * A count per module of what is open and waiting on somebody.
 *
 * Each row is gated on the permission that lets the actor act on it, so this is
 * a to-do list rather than a status board — and a row they cannot clear is not
 * shown to them at all.
 */
export async function openWorkByModule(
  ctx: ActorContext,
): Promise<{ label: string; count: number; href: string }[]> {
  const work = await pendingWork(ctx);
  const scope = companyScopeWhere(ctx);
  const has = (key: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(key);

  const [overdueTaskCount, documentsExpiring] = await Promise.all([
    has("tasks.view")
      ? prisma.task.count({
          where: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            dueDate: { lt: new Date() },
            ...scope,
          },
        })
      : Promise.resolve(0),
    has("documents.view")
      ? prisma.expiryIndex.count({
          where: {
            isActive: true,
            source: "DOCUMENT",
            expiryDate: { lte: expiryCutoff(30, new Date()) },
            ...scope,
          },
        })
      : Promise.resolve(0),
  ]);

  return [
    { label: "Petty cash", count: work.pettyCash, href: "/admin/petty-cash" },
    { label: "Leave", count: work.leave, href: "/people/leave" },
    { label: "Increments", count: work.increments, href: "/hr/increments" },
    { label: "IT tickets", count: work.openTickets, href: "/it/helpdesk" },
    { label: "Overdue tasks", count: overdueTaskCount, href: "/tasks?overdue=1" },
    { label: "Vehicle service", count: work.maintenanceDue, href: "/vehicles/maintenance" },
    { label: "Onboarding", count: work.onboarding, href: "/people/onboarding" },
    { label: "Offboarding", count: work.offboarding, href: "/people/offboarding" },
    { label: "Documents expiring", count: documentsExpiring, href: "/documents" },
  ].filter((row) => row.count > 0);
}

/**
 * One number per module, for the modules that do not warrant a chart.
 *
 * The dashboard previously showed nothing at all for fleet, accommodation,
 * insurance, vendors, or letters — a strip of counts is the honest amount of
 * space those deserve on a page about what needs attention today.
 */
export type ModuleTotals = {
  vehicles: number | null;
  bedsOccupied: number | null;
  bedsTotal: number | null;
  documents: number | null;
  letters: number | null;
  policies: number | null;
  suppliers: number | null;
  subcontractors: number | null;
  certificates: number | null;
};

export async function moduleTotals(ctx: ActorContext): Promise<ModuleTotals> {
  const scope = companyScopeWhere(ctx);
  const has = (key: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(key);

  // `null` means "not permitted to know", which the UI renders as absent rather
  // than as a zero — a zero is a fact, and this is not one.
  const [
    vehicles,
    bedsOccupied,
    bedsTotal,
    documents,
    letters,
    policies,
    suppliers,
    subcontractors,
    certificates,
  ] = await Promise.all([
    has("vehicles.view") ? prisma.vehicle.count({ where: scope }) : Promise.resolve(null),
    has("accommodation.view")
      ? prisma.accommodationBed.count({
          where: { status: "OCCUPIED", room: { accommodation: scope } },
        })
      : Promise.resolve(null),
    has("accommodation.view")
      ? prisma.accommodationBed.count({ where: { room: { accommodation: scope } } })
      : Promise.resolve(null),
    has("documents.view")
      ? prisma.document.count({ where: { deletedAt: null, ...scope } })
      : Promise.resolve(null),
    has("letters.view")
      ? prisma.generatedLetter.count({ where: scope })
      : Promise.resolve(null),
    has("insurance.view")
      ? prisma.medicalInsurancePolicy.count({ where: { status: "ACTIVE", ...scope } })
      : Promise.resolve(null),
    has("suppliers.view")
      ? prisma.supplier.count({ where: { deletedAt: null, status: "ACTIVE" } })
      : Promise.resolve(null),
    has("subcontractors.view")
      ? prisma.subcontractor.count({ where: { deletedAt: null, status: "ACTIVE" } })
      : Promise.resolve(null),
    has("certificates.view")
      ? prisma.companyCertificate.count({ where: { status: "ACTIVE", ...scope } })
      : Promise.resolve(null),
  ]);

  return {
    vehicles,
    bedsOccupied,
    bedsTotal,
    documents,
    letters,
    policies,
    suppliers,
    subcontractors,
    certificates,
  };
}


// --- Operational deadlines ---------------------------------------------------

/**
 * One deadline panel: how many, and the nearest few.
 *
 * `null` means NOT PERMITTED, which the dashboard renders as an absent card
 * rather than a zero. A zero is a fact about the business ("nothing is due");
 * a missing permission is a fact about the viewer, and showing it as 0 would
 * quietly tell someone the company has no overdue bills when really they just
 * cannot see bills.
 */
export type DeadlinePanel = {
  count: number;
  items: { id: string; label: string; sub: string | null; date: Date }[];
} | null;

export type OperationalDeadlines = {
  leaveUpcoming: DeadlinePanel;
  certificatesExpired: DeadlinePanel;
  billsDue: DeadlinePanel;
  subcontractsExpired: DeadlinePanel;
  rentDue: DeadlinePanel;
  employeeContracts: DeadlinePanel;
};

/** How far ahead each panel looks. Stated here so the cards can say so too. */
export const DEADLINE_WINDOWS = {
  leaveDays: 30,
  billsDays: 30,
  rentDays: 30,
  contractDays: 90,
} as const;

const PANEL_ITEMS = 5;

/**
 * The six operational deadlines the dashboard calls out.
 *
 * Three of them (certificates, subcontracts, employee contracts) read from
 * ExpiryIndex rather than their own tables — that projection exists precisely
 * so "what expires soon" is one indexed query per source instead of a union
 * across five modules (ADR-005).
 */
export async function operationalDeadlines(
  ctx: ActorContext,
): Promise<OperationalDeadlines> {
  const now = new Date();
  const todayStart = businessStartOfDay(now);
  const scope = companyScopeWhere(ctx);
  const has = (key: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(key);

  const expirySource = async (
    source: "COMPANY_CERTIFICATE" | "SUBCONTRACTOR_CONTRACT" | "EMPLOYEE_CONTRACT",
    where: { lt: Date } | { gte: Date; lte: Date },
  ): Promise<NonNullable<DeadlinePanel>> => {
    const filter = { isActive: true, source, expiryDate: where, ...scope };
    const [count, rows] = await Promise.all([
      prisma.expiryIndex.count({ where: filter }),
      prisma.expiryIndex.findMany({
        where: filter,
        orderBy: { expiryDate: "asc" },
        take: PANEL_ITEMS,
        select: { id: true, label: true, expiryDate: true },
      }),
    ]);
    return {
      count,
      items: rows.map((r) => ({ id: r.id, label: r.label, sub: null, date: r.expiryDate })),
    };
  };

  const [
    leaveUpcoming,
    certificatesExpired,
    billsDue,
    subcontractsExpired,
    rentDue,
    employeeContracts,
  ] = await Promise.all([
    // 1. Submitted leave whose travel date is close. PENDING only: an approved
    //    request is somebody else's problem, a pending one with travel next
    //    week is this dashboard's.
    has("hr.leave.view")
      ? (async (): Promise<NonNullable<DeadlinePanel>> => {
          const filter = {
            status: "PENDING" as const,
            startDate: { gte: todayStart, lte: expiryCutoff(DEADLINE_WINDOWS.leaveDays, now) },
            employee: { ...scope, deletedAt: null },
          };
          const [count, rows] = await Promise.all([
            prisma.leaveRequest.count({ where: filter }),
            prisma.leaveRequest.findMany({
              where: filter,
              orderBy: { startDate: "asc" },
              take: PANEL_ITEMS,
              select: {
                id: true,
                startDate: true,
                employee: { select: { fullName: true } },
                leaveType: { select: { name: true } },
              },
            }),
          ]);
          return {
            count,
            items: rows.map((r) => ({
              id: r.id,
              label: r.employee.fullName,
              sub: r.leaveType.name,
              date: r.startDate,
            })),
          };
        })()
      : Promise.resolve(null),

    // 2. Certificates already expired — not "expiring", expired. A lapsed CR or
    //    licence is an operating problem today.
    has("certificates.view")
      ? expirySource("COMPANY_CERTIFICATE", { lt: todayStart })
      : Promise.resolve(null),

    // 3. Electricity bills due or already overdue. PAID is excluded by status
    //    rather than by date, so a bill paid early stops appearing at once.
    has("bills.view")
      ? (async (): Promise<NonNullable<DeadlinePanel>> => {
          const filter = {
            status: { in: ["PENDING", "OVERDUE"] satisfies BillStatus[] },
            dueDate: { lte: expiryCutoff(DEADLINE_WINDOWS.billsDays, now) },
            ...scope,
          };
          const [count, rows] = await Promise.all([
            prisma.electricityBill.count({ where: filter }),
            prisma.electricityBill.findMany({
              where: filter,
              orderBy: { dueDate: "asc" },
              take: PANEL_ITEMS,
              select: { id: true, location: true, amount: true, currency: true, dueDate: true },
            }),
          ]);
          return {
            count,
            items: rows.map((r) => ({
              id: r.id,
              label: r.location,
              sub: `${r.amount.toString()} ${r.currency}`,
              date: r.dueDate,
            })),
          };
        })()
      : Promise.resolve(null),

    // 4. Subcontractor contracts already expired.
    has("subcontractors.view")
      ? expirySource("SUBCONTRACTOR_CONTRACT", { lt: todayStart })
      : Promise.resolve(null),

    // 5. Rent falling due. Includes dates already past, because rent that was
    //    due last week is more urgent than rent due next week, not less.
    has("accommodation.view")
      ? (async (): Promise<NonNullable<DeadlinePanel>> => {
          const filter = {
            status: "ACTIVE" as const,
            rentDueDate: { not: null, lte: expiryCutoff(DEADLINE_WINDOWS.rentDays, now) },
            ...scope,
          };
          const [count, rows] = await Promise.all([
            prisma.accommodation.count({ where: filter }),
            prisma.accommodation.findMany({
              where: filter,
              orderBy: { rentDueDate: "asc" },
              take: PANEL_ITEMS,
              select: {
                id: true,
                name: true,
                city: true,
                rentAmount: true,
                rentCurrency: true,
                rentDueDate: true,
              },
            }),
          ]);
          return {
            count,
            items: rows.map((r) => ({
              id: r.id,
              label: r.name,
              sub: r.rentAmount ? `${r.rentAmount.toString()} ${r.rentCurrency}` : r.city,
              // Non-null by the filter above; the type does not know that.
              date: r.rentDueDate ?? new Date(),
            })),
          };
        })()
      : Promise.resolve(null),

    // 6. Employee contracts expiring inside the notice window.
    has("hr.contracts.view")
      ? expirySource("EMPLOYEE_CONTRACT", {
          gte: todayStart,
          lte: expiryCutoff(DEADLINE_WINDOWS.contractDays, now),
        })
      : Promise.resolve(null),
  ]);

  return {
    leaveUpcoming,
    certificatesExpired,
    billsDue,
    subcontractsExpired,
    rentDue,
    employeeContracts,
  };
}
