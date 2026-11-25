import "server-only";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { businessStartOfDay, expiryCutoff } from "@/lib/expiry";

/**
 * Dashboard aggregates: what the person running the office acts on — their
 * tasks, who is in and who is away, what needs renewing, and what is due.
 * Every count is company-scoped here, and each block is gated on the
 * permission that lets the viewer act on it (null = not shown, not zero).
 */

const dayUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

// --- Staff ---------------------------------------------------------------------

export type StaffRow = {
  code: string;
  active: number;
  onLeave: number;
  newHires: number;
  joined: number;
  left: number;
};

/** Staff per company: on strength, away today, still to join, and this month's movement. */
export async function staffSummary(ctx: ActorContext): Promise<StaffRow[] | null> {
  if (!ctx.permissions.has("employees.view")) return null;
  const now = new Date();
  const today = dayUtc(now);
  const start = monthStart(now);
  const scope = { deletedAt: null, ...companyScopeWhere(ctx) };

  const [companies, onStrength, newHires, joined, left, away] = await Promise.all([
    prisma.company.findMany({
      where: ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true },
    }),
    prisma.employee.groupBy({
      by: ["companyId"],
      where: { ...scope, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["companyId"],
      where: { ...scope, status: "NEW_HIRE" },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["companyId"],
      where: { ...scope, status: { in: ["ACTIVE", "ON_LEAVE"] }, joiningDate: { gte: start, lte: now } },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["companyId"],
      where: { ...scope, lastWorkingDate: { gte: start, lte: now } },
      _count: { _all: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
        employee: scope,
      },
      distinct: ["employeeId"],
      select: { employee: { select: { companyId: true } } },
    }),
  ]);

  const count = (rows: { companyId: string; _count: { _all: number } }[], id: string) =>
    rows.find((r) => r.companyId === id)?._count._all ?? 0;

  return companies.map((c) => ({
    code: c.code,
    active: count(onStrength, c.id),
    onLeave: away.filter((a) => a.employee.companyId === c.id).length,
    newHires: count(newHires, c.id),
    joined: count(joined, c.id),
    left: count(left, c.id),
  }));
}

// --- Leave -----------------------------------------------------------------------

export type LeaveSnapshot = {
  away: { id: string; name: string; type: string; until: Date }[];
  soon: { id: string; name: string; type: string; from: Date }[];
};

/** Who is on leave today, and who goes in the next two weeks. */
export async function leaveSnapshot(ctx: ActorContext): Promise<LeaveSnapshot | null> {
  if (!ctx.permissions.has("hr.leave.view")) return null;
  const today = dayUtc(new Date());
  const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const employee = { ...companyScopeWhere(ctx), deletedAt: null };
  const select = {
    id: true,
    startDate: true,
    endDate: true,
    leaveType: { select: { name: true } },
    employee: { select: { fullName: true } },
  } as const;

  const [away, soon] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today }, employee },
      orderBy: { endDate: "asc" },
      take: 50,
      select,
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { gt: today, lte: in14 }, employee },
      orderBy: { startDate: "asc" },
      take: 50,
      select,
    }),
  ]);

  return {
    away: away.map((l) => ({
      id: l.id,
      name: l.employee.fullName,
      type: l.leaveType.name,
      until: l.endDate,
    })),
    soon: soon.map((l) => ({
      id: l.id,
      name: l.employee.fullName,
      type: l.leaveType.name,
      from: l.startDate,
    })),
  };
}

// --- Renewals --------------------------------------------------------------------

export type RenewalCounts = { expired: number; within30: number; within90: number };

/** Everything with an expiry date: already expired, due within 30, within 90 days. */
export async function renewalCounts(ctx: ActorContext): Promise<RenewalCounts> {
  const now = new Date();
  const todayStart = businessStartOfDay(now);
  const base = { isActive: true, ...companyScopeWhere(ctx) };
  const [expired, within30, within90] = await Promise.all([
    prisma.expiryIndex.count({ where: { ...base, expiryDate: { lt: todayStart } } }),
    prisma.expiryIndex.count({
      where: { ...base, expiryDate: { gte: todayStart, lte: expiryCutoff(30, now) } },
    }),
    prisma.expiryIndex.count({
      where: { ...base, expiryDate: { gte: todayStart, lte: expiryCutoff(90, now) } },
    }),
  ]);
  return { expired, within30, within90 };
}

// --- Needs attention -------------------------------------------------------------

export type AttentionRow = {
  key: string;
  label: string;
  hint: string;
  count: number;
  href: string;
  tone: "expired" | "warning" | "info";
};

/**
 * Things that are due or overdue, one line each, and only the ones that have
 * something in them: a list of zeroes is not a to-do list.
 */
export async function needsAttention(ctx: ActorContext): Promise<AttentionRow[]> {
  const now = new Date();
  const todayStart = businessStartOfDay(now);
  const scope = companyScopeWhere(ctx);
  const has = (key: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(key);
  const expiring = (
    source:
      | "COMPANY_CERTIFICATE"
      | "SUBCONTRACTOR_CONTRACT"
      | "EMPLOYEE_CONTRACT"
      | "MEDICAL_INSURANCE_POLICY",
    expiryDate: { lt: Date } | { lte: Date },
  ) => prisma.expiryIndex.count({ where: { isActive: true, source, expiryDate, ...scope } });
  const none = Promise.resolve(0);

  const [
    newHires,
    contractsEnding,
    rentDue,
    certificates,
    subcontracts,
    services,
    policies,
    iqamaRenewals,
  ] = await Promise.all([
    has("employees.view")
      ? prisma.employee.count({ where: { deletedAt: null, status: "NEW_HIRE", ...scope } })
      : none,
    has("hr.contracts.view") ? expiring("EMPLOYEE_CONTRACT", { lte: expiryCutoff(90, now) }) : none,
    has("accommodation.view")
      ? prisma.accommodation.count({
          where: { status: "ACTIVE", rentDueDate: { not: null, lte: expiryCutoff(30, now) }, ...scope },
        })
      : none,
    has("certificates.view") ? expiring("COMPANY_CERTIFICATE", { lt: todayStart }) : none,
    has("subcontractors.view") ? expiring("SUBCONTRACTOR_CONTRACT", { lt: todayStart }) : none,
    has("vehicles.maintenance.view")
      ? prisma.vehicleMaintenance.count({
          where: {
            status: { not: "CANCELLED" },
            nextDueDate: { not: null, lte: expiryCutoff(30, now) },
            vehicle: scope,
          },
        })
      : none,
    has("insurance.view")
      ? expiring("MEDICAL_INSURANCE_POLICY", { lte: expiryCutoff(30, now) })
      : none,
    has("employees.view")
      ? prisma.iqamaRenewal.count({
          where: {
            status: { in: ["IN_PROGRESS", "SUBMITTED"] },
            iqamaRecord: { employee: { deletedAt: null, ...scope } },
          },
        })
      : none,
  ]);

  const rows: AttentionRow[] = [
    {
      key: "certificates",
      label: "Company certificates expired",
      hint: "Renew and upload the new certificate",
      count: certificates,
      href: "/admin/certificates",
      tone: "expired",
    },
    {
      key: "subcontracts",
      label: "Subcontracts expired",
      hint: "Renew or close them",
      count: subcontracts,
      href: "/admin/subcontractors",
      tone: "expired",
    },
    {
      key: "rent",
      label: "Accommodation rent due",
      hint: "Due within 30 days or already past",
      count: rentDue,
      href: "/admin/accommodation",
      tone: "warning",
    },
    {
      key: "policies",
      label: "Medical insurance policies expiring",
      hint: "Within 30 days or expired",
      count: policies,
      href: "/insurance",
      tone: "warning",
    },
    {
      key: "contracts",
      label: "Employee contracts ending",
      hint: "Within 90 days or ended",
      count: contractsEnding,
      href: "/hr/contracts",
      tone: "warning",
    },
    {
      key: "services",
      label: "Vehicle services due",
      hint: "Within 30 days or overdue",
      count: services,
      href: "/vehicles/maintenance",
      tone: "warning",
    },
    {
      key: "newHires",
      label: "New hires not joined yet",
      hint: "Make the joining letter on their first day",
      count: newHires,
      href: "/people/employees?status=NEW_HIRE",
      tone: "info",
    },
    {
      key: "iqamaRenewals",
      label: "Iqama renewals in progress",
      hint: "Started and not yet completed",
      count: iqamaRenewals,
      href: "/people/iqama",
      tone: "info",
    },
  ];
  return rows.filter((r) => r.count > 0);
}

// --- Headcount by department -----------------------------------------------------

/** Staff on strength per department — the donut beside the staff table. */
export async function headcountByDepartment(
  ctx: ActorContext,
): Promise<{ name: string; count: number }[]> {
  if (!ctx.permissions.has("employees.view")) return [];

  const grouped = await prisma.employee.groupBy({
    by: ["departmentId"],
    where: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] }, ...companyScopeWhere(ctx) },
    _count: { _all: true },
  });

  const ids = grouped.map((g) => g.departmentId).filter((id): id is string => id !== null);
  const departments =
    ids.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, company: { select: { code: true } } },
        })
      : [];

  // A department name both companies use carries its company code.
  const nameCounts = new Map<string, number>();
  for (const d of departments) nameCounts.set(d.name, (nameCounts.get(d.name) ?? 0) + 1);
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
}
