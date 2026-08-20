import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere } from "@/server/auth/guards";
import { ForbiddenError } from "@/lib/result";
import { daysUntilExpiry } from "@/lib/expiry";
import {
  expiryBucketLabel,
  isCompanyInScope,
  REPORTS,
  type ReportId,
  type ReportSpec,
} from "@/lib/reports";
import { resolveUserNames } from "./users";

/**
 * Report queries — brief §36.
 *
 * Every query applies `companyScopeWhere(ctx)`, and every gated column is
 * omitted from the SELECT rather than fetched and hidden. That second point is
 * the one that matters: hiding a column client-side leaves the value in the
 * payload, and an export built from the same rows would carry it.
 *
 * Rows come back as `Record<string, CellValue>` keyed by the column keys in
 * `lib/reports.ts`, so the table renderer and the exporter consume one shape.
 */

export type ReportFilters = {
  companyId?: string | undefined;
  departmentId?: string | undefined;
  status?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  q?: string | undefined;
};

export type ReportRow = Record<string, string | number | boolean | Date | null>;

export type ReportResult = {
  spec: ReportSpec;
  rows: ReportRow[];
  /** True when the row cap was hit, so the UI can say so rather than mislead. */
  truncated: boolean;
  generatedAt: Date;
};

/**
 * Hard cap. A report is for reading and exporting, not for dumping the
 * database; without it one query can exhaust the function's memory.
 */
const MAX_ROWS = 5000;

/**
 * Narrows the company scope to a single company when the filter asks for one.
 *
 * The filter can only narrow, never widen: an out-of-scope companyId is
 * rejected rather than ignored, because silently returning the full scope
 * would look like the filter worked.
 */
type CompanyScope = { companyId?: { in: string[] } | string };

function scopeWhere(ctx: ActorContext, filters: ReportFilters): CompanyScope {
  if (!filters.companyId) return companyScopeWhere(ctx);

  if (!isCompanyInScope(ctx.companyScope, filters.companyId)) {
    throw new ForbiddenError("Record not found.");
  }
  return { companyId: filters.companyId };
}

/**
 * Inclusive date window as a spreadable fragment keyed on the given field.
 *
 * Returns the whole key or nothing rather than a possibly-undefined value:
 * under `exactOptionalPropertyTypes`, `{ dueDate: undefined }` is not the same
 * as omitting `dueDate`, and Prisma rejects the former.
 */
function dateWindowOn<K extends string>(
  field: K,
  filters: ReportFilters,
): Record<K, Prisma.DateTimeFilter> | Record<string, never> {
  if (!filters.from && !filters.to) return {};
  return {
    [field]: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  } as Record<K, Prisma.DateTimeFilter>;
}

export async function runReport(
  ctx: ActorContext,
  id: ReportId,
  filters: ReportFilters,
): Promise<ReportResult> {
  const spec = REPORTS[id];

  // Both gates, in the order the pipeline uses everywhere else.
  if (!ctx.permissions.has("reports.view")) {
    throw new ForbiddenError("You do not have permission to view reports.");
  }
  if (!ctx.permissions.has(spec.permission)) {
    throw new ForbiddenError("You do not have permission to view this report.");
  }

  const rows = await QUERIES[id](ctx, filters);

  return {
    spec,
    rows: rows.slice(0, MAX_ROWS),
    truncated: rows.length > MAX_ROWS,
    generatedAt: new Date(),
  };
}

type QueryFn = (ctx: ActorContext, filters: ReportFilters) => Promise<ReportRow[]>;

// --- Employees ---------------------------------------------------------------

const employeeDirectory: QueryFn = async (ctx, filters) => {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");
  const canSeeBank = ctx.permissions.has("employees.bank.view");

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...scopeWhere(ctx, filters),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { fullName: { contains: filters.q, mode: "insensitive" as const } },
              { employeeNo: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { employeeNo: "asc" },
    take: MAX_ROWS + 1,
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      fullNameAr: true,
      status: true,
      nationality: true,
      joiningDate: true,
      mobile: true,
      workEmail: true,
      company: { select: { code: true } },
      department: { select: { name: true } },
      position: { select: { title: true } },
      iqama: { select: { iqamaNumber: true, expiryDate: true } },
    },
  });

  const ids = employees.map((e) => e.id);

  // Sensitive fields are fetched by their own queries, which simply do not run
  // without the permission. A conditional key inside one `select` would read
  // as equivalent but is easy to defeat later by "just adding the field back";
  // a query that never executes cannot leak.
  const salaries = canSeeSalary ? await salaryByEmployee(ids) : null;
  const ibans = canSeeBank ? await ibanByEmployee(ids) : null;

  return employees.map((e) => ({
    employeeNo: e.employeeNo,
    fullName: e.fullName,
    fullNameAr: e.fullNameAr,
    company: e.company.code,
    department: e.department?.name ?? null,
    position: e.position?.title ?? null,
    status: e.status,
    nationality: e.nationality,
    joiningDate: e.joiningDate,
    mobile: e.mobile,
    workEmail: e.workEmail,
    iqamaNumber: e.iqama?.iqamaNumber ?? null,
    iqamaExpiry: e.iqama?.expiryDate ?? null,
    ...(salaries ? { basicSalary: salaries.get(e.id) ?? null } : {}),
    ...(ibans ? { iban: ibans.get(e.id) ?? null } : {}),
  }));
};

/** Only ever called behind `employees.salary.view`. */
async function salaryByEmployee(employeeIds: string[]): Promise<Map<string, string>> {
  if (employeeIds.length === 0) return new Map();

  const contracts = await prisma.contract.findMany({
    where: { employeeId: { in: employeeIds }, status: "ACTIVE", deletedAt: null },
    orderBy: { startDate: "desc" },
    select: { employeeId: true, basicSalary: true },
  });

  const out = new Map<string, string>();
  // Ordered newest-first, so the first entry per employee is the current one.
  for (const c of contracts) {
    if (c.basicSalary !== null && !out.has(c.employeeId)) {
      out.set(c.employeeId, c.basicSalary.toString());
    }
  }
  return out;
}

/** Only ever called behind `employees.bank.view`. */
async function ibanByEmployee(employeeIds: string[]): Promise<Map<string, string>> {
  if (employeeIds.length === 0) return new Map();

  const details = await prisma.employeeBankDetail.findMany({
    where: { employeeId: { in: employeeIds } },
    select: { employeeId: true, iban: true },
  });

  return new Map(
    details
      .filter((d): d is typeof d & { iban: string } => d.iban !== null)
      .map((d) => [d.employeeId, d.iban]),
  );
}

const employeeHeadcount: QueryFn = async (ctx, filters) => {
  const grouped = await prisma.employee.groupBy({
    by: ["companyId", "departmentId", "status"],
    where: {
      deletedAt: null,
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
    },
    _count: { _all: true },
  });

  const [companies, departments] = await Promise.all([
    prisma.company.findMany({ select: { id: true, code: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);
  const companyCode = new Map(companies.map((c) => [c.id, c.code]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));

  // One row per company + department, statuses pivoted into columns.
  const buckets = new Map<string, ReportRow>();

  for (const row of grouped) {
    const key = `${row.companyId}::${row.departmentId ?? ""}`;
    const existing = buckets.get(key) ?? {
      company: companyCode.get(row.companyId) ?? row.companyId,
      department: row.departmentId
        ? (departmentName.get(row.departmentId) ?? row.departmentId)
        : "Unassigned",
      active: 0,
      onLeave: 0,
      resigned: 0,
      terminated: 0,
      inactive: 0,
      total: 0,
    };

    // EXITED and INACTIVE both mean "no longer working here but not a
    // termination", so they share a column rather than inventing two.
    const column =
      row.status === "ACTIVE"
        ? "active"
        : row.status === "ON_LEAVE"
          ? "onLeave"
          : row.status === "RESIGNED"
            ? "resigned"
            : row.status === "TERMINATED"
              ? "terminated"
              : "inactive";

    existing[column] = Number(existing[column] ?? 0) + row._count._all;
    existing.total = Number(existing.total ?? 0) + row._count._all;
    buckets.set(key, existing);
  }

  return [...buckets.values()].sort(
    (a, b) =>
      String(a.company).localeCompare(String(b.company)) ||
      String(a.department).localeCompare(String(b.department)),
  );
};

const joinersLeavers: QueryFn = async (ctx, filters) => {
  const scope = scopeWhere(ctx, filters);
  const department = filters.departmentId ? { departmentId: filters.departmentId } : {};
  const hasWindow = Boolean(filters.from ?? filters.to);

  const select = {
    employeeNo: true,
    fullName: true,
    status: true,
    joiningDate: true,
    lastWorkingDate: true,
    company: { select: { code: true } },
    department: { select: { name: true } },
    position: { select: { title: true } },
  } satisfies Prisma.EmployeeSelect;

  const [joiners, leavers] = await Promise.all([
    prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...scope,
        ...department,
        ...dateWindowOn("joiningDate", filters),
      },
      orderBy: { joiningDate: "desc" },
      take: MAX_ROWS + 1,
      select,
    }),
    prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...scope,
        ...department,
        // With no window, "left" means any employee who has a last working
        // date at all; with one, it means left inside it.
        ...(hasWindow
          ? dateWindowOn("lastWorkingDate", filters)
          : { lastWorkingDate: { not: null } }),
      },
      orderBy: { lastWorkingDate: "desc" },
      take: MAX_ROWS + 1,
      select,
    }),
  ]);

  const toRow = (e: (typeof joiners)[number], event: "Joined" | "Left", date: Date | null) => ({
    employeeNo: e.employeeNo,
    fullName: e.fullName,
    company: e.company.code,
    department: e.department?.name ?? null,
    position: e.position?.title ?? null,
    event,
    eventDate: date,
    status: e.status,
  });

  return [
    ...joiners.map((e) => toRow(e, "Joined", e.joiningDate)),
    ...leavers.map((e) => toRow(e, "Left", e.lastWorkingDate)),
  ].sort((a, b) => (b.eventDate?.getTime() ?? 0) - (a.eventDate?.getTime() ?? 0));
};

// --- Compliance --------------------------------------------------------------

/**
 * Reads the ExpiryIndex projection (ADR-005) rather than eleven source tables.
 * This is the report that projection was built for.
 */
const expiryRegister: QueryFn = async (ctx, filters) => {
  const now = new Date();

  const items = await prisma.expiryIndex.findMany({
    where: {
      isActive: true,
      ...scopeWhere(ctx, filters),
      ...dateWindowOn("expiryDate", filters),
      ...(filters.status && filters.status !== "ALL"
        ? { source: filters.status as "IQAMA" }
        : {}),
    },
    orderBy: { expiryDate: "asc" },
    take: MAX_ROWS + 1,
    select: {
      source: true,
      label: true,
      expiryDate: true,
      company: { select: { code: true } },
      employee: { select: { fullName: true } },
    },
  });

  return items.map((item) => {
    const days = daysUntilExpiry(item.expiryDate, now);
    return {
      source: item.source.replace(/_/g, " "),
      label: item.label,
      employee: item.employee?.fullName ?? null,
      company: item.company?.code ?? null,
      expiryDate: item.expiryDate,
      daysRemaining: days,
      bucket: expiryBucketLabel(days),
    };
  });
};

// --- HR ----------------------------------------------------------------------

const contractRegister: QueryFn = async (ctx, filters) => {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const contracts = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...dateWindowOn("endDate", filters),
    },
    orderBy: [{ endDate: { sort: "asc", nulls: "last" } }],
    take: MAX_ROWS + 1,
    select: {
      id: true,
      contractType: true,
      startDate: true,
      endDate: true,
      probationEndDate: true,
      status: true,
      currency: true,
      company: { select: { code: true } },
      employee: { select: { employeeNo: true, fullName: true } },
    },
  });

  // As in the directory: the salary read is its own query, gated by control
  // flow rather than by a conditional key.
  const salaries = canSeeSalary
    ? new Map(
        (
          await prisma.contract.findMany({
            where: { id: { in: contracts.map((c) => c.id) } },
            select: { id: true, basicSalary: true },
          })
        ).map((c) => [c.id, c.basicSalary?.toString() ?? null]),
      )
    : null;

  return contracts.map((c) => ({
    employeeNo: c.employee.employeeNo,
    fullName: c.employee.fullName,
    company: c.company.code,
    contractType: c.contractType,
    startDate: c.startDate,
    endDate: c.endDate,
    probationEndDate: c.probationEndDate,
    status: c.status,
    ...(salaries ? { basicSalary: salaries.get(c.id) ?? null } : {}),
    currency: c.currency,
  }));
};

const leaveRegister: QueryFn = async (ctx, filters) => {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      employee: {
        deletedAt: null,
        ...scopeWhere(ctx, filters),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...dateWindowOn("startDate", filters),
    },
    orderBy: { startDate: "desc" },
    take: MAX_ROWS + 1,
    select: {
      startDate: true,
      endDate: true,
      days: true,
      status: true,
      leaveType: { select: { name: true } },
      approver: { select: { fullName: true } },
      employee: {
        select: {
          employeeNo: true,
          fullName: true,
          company: { select: { code: true } },
        },
      },
    },
  });

  return requests.map((r) => ({
    employeeNo: r.employee.employeeNo,
    fullName: r.employee.fullName,
    company: r.employee.company.code,
    leaveType: r.leaveType.name,
    startDate: r.startDate,
    endDate: r.endDate,
    days: Number(r.days),
    status: r.status,
    approver: r.approver?.fullName ?? null,
  }));
};

// --- IT ----------------------------------------------------------------------

const itAssetRegister: QueryFn = async (ctx, filters) => {
  const assets = await prisma.iTAsset.findMany({
    where: {
      deletedAt: null,
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "AVAILABLE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { assetCode: { contains: filters.q, mode: "insensitive" as const } },
              { serialNumber: { contains: filters.q, mode: "insensitive" as const } },
              { brand: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { assetCode: "asc" },
    take: MAX_ROWS + 1,
    select: {
      assetCode: true,
      type: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      condition: true,
      purchaseDate: true,
      warrantyExpiry: true,
      purchaseCost: true,
      company: { select: { code: true } },
      assignments: {
        where: { returnedAt: null },
        take: 1,
        select: { employee: { select: { fullName: true } } },
      },
    },
  });

  return assets.map((a) => ({
    assetCode: a.assetCode,
    type: a.type,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serialNumber,
    status: a.status,
    condition: a.condition,
    assignedTo: a.assignments[0]?.employee.fullName ?? null,
    company: a.company.code,
    purchaseDate: a.purchaseDate,
    warrantyExpiry: a.warrantyExpiry,
    purchaseCost: a.purchaseCost?.toString() ?? null,
  }));
};

const helpdeskTickets: QueryFn = async (ctx, filters) => {
  const now = Date.now();

  const tickets = await prisma.iTTicket.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "OPEN" } : {}),
      ...dateWindowOn("createdAt", filters),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS + 1,
    select: {
      ticketNo: true,
      subject: true,
      priority: true,
      status: true,
      requesterId: true,
      assignedToId: true,
      createdAt: true,
      resolvedAt: true,
      category: { select: { name: true } },
    },
  });

  const names = await resolveUserNames(
    tickets.flatMap((t) => [t.requesterId, t.assignedToId]),
  );

  return tickets.map((t) => ({
    ticketNo: t.ticketNo,
    subject: t.subject,
    category: t.category.name,
    priority: t.priority,
    status: t.status,
    requester: names.get(t.requesterId) ?? null,
    assignedTo: t.assignedToId ? (names.get(t.assignedToId) ?? null) : null,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    // Age stops at resolution — an open ticket ages, a closed one does not.
    ageDays: Math.floor(
      ((t.resolvedAt?.getTime() ?? now) - t.createdAt.getTime()) / 86_400_000,
    ),
  }));
};

// --- Fleet -------------------------------------------------------------------

const fleetRegister: QueryFn = async (ctx, filters) => {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      deletedAt: null,
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { plateNumber: { contains: filters.q, mode: "insensitive" as const } },
              { vehicleCode: { contains: filters.q, mode: "insensitive" as const } },
              { make: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { vehicleCode: "asc" },
    take: MAX_ROWS + 1,
    select: {
      vehicleCode: true,
      plateNumber: true,
      make: true,
      model: true,
      year: true,
      status: true,
      registrationExpiry: true,
      insuranceExpiry: true,
      company: { select: { code: true } },
      currentDriver: { select: { fullName: true } },
    },
  });

  return vehicles.map((v) => ({
    vehicleCode: v.vehicleCode,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    year: v.year,
    status: v.status,
    currentDriver: v.currentDriver?.fullName ?? null,
    company: v.company.code,
    registrationExpiry: v.registrationExpiry,
    insuranceExpiry: v.insuranceExpiry,
  }));
};

// --- Insurance ---------------------------------------------------------------

const insuranceRegister: QueryFn = async (ctx, filters) => {
  const policies = await prisma.medicalInsurancePolicy.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
    },
    orderBy: { expiryDate: "asc" },
    take: MAX_ROWS + 1,
    select: {
      policyNumber: true,
      className: true,
      startDate: true,
      expiryDate: true,
      status: true,
      isWorking: true,
      company: { select: { code: true } },
      provider: { select: { name: true } },
      _count: { select: { members: true } },
    },
  });

  return policies.map((p) => ({
    policyNumber: p.policyNumber,
    provider: p.provider.name,
    company: p.company.code,
    className: p.className,
    startDate: p.startDate,
    expiryDate: p.expiryDate,
    status: p.status,
    isWorking: p.isWorking,
    memberCount: p._count.members,
  }));
};

// --- Tasks & letters ---------------------------------------------------------

const taskRegister: QueryFn = async (ctx, filters) => {
  const now = new Date();
  const CLOSED = ["COMPLETED", "CANCELLED"] as const;

  const tasks = await prisma.task.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "TODO" } : {}),
      ...dateWindowOn("dueDate", filters),
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    take: MAX_ROWS + 1,
    select: {
      taskNo: true,
      title: true,
      priority: true,
      status: true,
      dueDate: true,
      assignedToId: true,
      company: { select: { code: true } },
    },
  });

  const names = await resolveUserNames(tasks.map((t) => t.assignedToId));

  return tasks.map((t) => ({
    taskNo: t.taskNo,
    title: t.title,
    priority: t.priority,
    status: t.status,
    assignedTo: t.assignedToId ? (names.get(t.assignedToId) ?? null) : null,
    dueDate: t.dueDate,
    // Derived, never stored — a stored flag goes stale at midnight.
    isOverdue:
      t.dueDate !== null &&
      t.dueDate < now &&
      !(CLOSED as readonly string[]).includes(t.status),
    company: t.company.code,
  }));
};

const letterRegister: QueryFn = async (ctx, filters) => {
  const letters = await prisma.generatedLetter.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "GENERATED" } : {}),
      ...dateWindowOn("generatedAt", filters),
      // Same gate as the letter detail page: a register that listed salary
      // letters the actor cannot open would be a directory of what to ask for,
      // but the metadata itself is not the secret — only the body is. Rows stay
      // visible; SECURITY §3 covers why.
    },
    orderBy: { generatedAt: "desc" },
    take: MAX_ROWS + 1,
    select: {
      letterNo: true,
      status: true,
      generatedAt: true,
      template: { select: { name: true, type: true } },
      employee: { select: { fullName: true } },
      company: { select: { code: true } },
    },
  });

  return letters.map((l) => ({
    letterNo: l.letterNo,
    type: l.template.type.replace(/_/g, " "),
    templateName: l.template.name,
    employee: l.employee?.fullName ?? null,
    company: l.company.code,
    generatedAt: l.generatedAt,
    status: l.status,
  }));
};

// --- Administration ----------------------------------------------------------

const pettyCashLedger: QueryFn = async (ctx, filters) => {
  const rows = await prisma.pettyCashTransaction.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...dateWindowOn("date", filters),
    },
    orderBy: [{ date: "desc" }],
    take: MAX_ROWS + 1,
    select: {
      date: true,
      type: true,
      description: true,
      amount: true,
      currency: true,
      paymentMethod: true,
      status: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
      company: { select: { code: true } },
    },
  });

  return rows.map((t) => ({
    date: t.date,
    account: t.account.name,
    company: t.company.code,
    type: t.type,
    category: t.category.name,
    description: t.description,
    amount: t.amount.toString(),
    currency: t.currency,
    paymentMethod: t.paymentMethod,
    status: t.status,
  }));
};

const accommodationOccupancy: QueryFn = async (ctx, filters) => {
  // Driven from the bed, not the assignment, so empty beds appear too — the
  // question this report answers is usually "where is there room?".
  const beds = await prisma.accommodationBed.findMany({
    where: {
      room: { accommodation: { ...scopeWhere(ctx, filters) } },
      ...(filters.status ? { status: filters.status as "AVAILABLE" } : {}),
    },
    orderBy: [{ room: { accommodation: { name: "asc" } } }, { bedLabel: "asc" }],
    take: MAX_ROWS + 1,
    select: {
      bedLabel: true,
      status: true,
      room: {
        select: {
          roomNumber: true,
          accommodation: { select: { name: true, city: true, company: { select: { code: true } } } },
        },
      },
      assignments: {
        where: { checkOutDate: null },
        select: {
          checkInDate: true,
          employee: { select: { employeeNo: true, fullName: true } },
        },
      },
    },
  });

  return beds.map((b) => {
    const current = b.assignments[0] ?? null;
    return {
      accommodation: b.room.accommodation.name,
      company: b.room.accommodation.company.code,
      city: b.room.accommodation.city,
      room: b.room.roomNumber,
      bed: b.bedLabel,
      bedStatus: b.status,
      employeeNo: current?.employee.employeeNo ?? null,
      occupant: current?.employee.fullName ?? null,
      checkInDate: current?.checkInDate ?? null,
    };
  });
};

const supplierRegister: QueryFn = async (ctx, filters) => {
  const suppliers = await prisma.supplier.findMany({
    where: {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      // Composed under AND for the same reason as listSuppliers in
      // services/vendors.ts: the scope helper and the search filter both emit
      // `OR`, and spreading both drops the scope entirely, so a searched
      // report crossed company boundaries.
      //
      // Suppliers may be shared across companies, so the nullable-aware helper
      // applies rather than the strict one.
      AND: [
        filters.companyId ? scopeWhere(ctx, filters) : optionalCompanyScopeWhere(ctx),
        ...(filters.q
          ? [
              {
                OR: [
                  { name: { contains: filters.q, mode: "insensitive" as const } },
                  { code: { contains: filters.q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: { code: "asc" },
    take: MAX_ROWS + 1,
    select: {
      code: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      creditDays: true,
      status: true,
      company: { select: { code: true } },
      category: { select: { name: true } },
    },
  });

  return suppliers.map((v) => ({
    code: v.code,
    name: v.name,
    company: v.company?.code ?? null,
    category: v.category?.name ?? null,
    contactPerson: v.contactPerson,
    phone: v.phone,
    email: v.email,
    creditDays: v.creditDays,
    status: v.status,
  }));
};

const subcontractorRegister: QueryFn = async (ctx, filters) => {
  // Subcontractors carry no company column; their contracts do, so scope is
  // applied to the counted contracts rather than to the subcontractor.
  const subs = await prisma.subcontractor.findMany({
    where: {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { code: { contains: filters.q, mode: "insensitive" as const } },
              { crNumber: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { code: "asc" },
    take: MAX_ROWS + 1,
    select: {
      code: true,
      name: true,
      crNumber: true,
      contactPerson: true,
      phone: true,
      status: true,
      _count: { select: { contracts: { where: companyScopeWhere(ctx) } } },
    },
  });

  return subs.map((v) => ({
    code: v.code,
    name: v.name,
    crNumber: v.crNumber,
    contactPerson: v.contactPerson,
    phone: v.phone,
    contracts: v._count.contracts,
    status: v.status,
  }));
};

const electricityBills: QueryFn = async (ctx, filters) => {
  const bills = await prisma.electricityBill.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...dateWindowOn("dueDate", filters),
    },
    orderBy: [{ dueDate: "desc" }],
    take: MAX_ROWS + 1,
    select: {
      location: true,
      meterNumber: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      amount: true,
      currency: true,
      dueDate: true,
      paidDate: true,
      status: true,
      company: { select: { code: true } },
    },
  });

  return bills.map((b) => ({
    location: b.location,
    company: b.company.code,
    meterNumber: b.meterNumber,
    periodStart: b.billingPeriodStart,
    periodEnd: b.billingPeriodEnd,
    amount: b.amount.toString(),
    currency: b.currency,
    dueDate: b.dueDate,
    paidDate: b.paidDate,
    status: b.status,
  }));
};

const certificateRegister: QueryFn = async (ctx, filters) => {
  const certificates = await prisma.companyCertificate.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...dateWindowOn("expiryDate", filters),
    },
    orderBy: [{ expiryDate: "asc" }],
    take: MAX_ROWS + 1,
    select: {
      certificateNo: true,
      issuingAuthority: true,
      issueDate: true,
      expiryDate: true,
      status: true,
      company: { select: { code: true } },
      certificateType: { select: { name: true } },
    },
  });

  return certificates.map((c) => ({
    certificateNo: c.certificateNo,
    type: c.certificateType.name,
    company: c.company.code,
    issuingAuthority: c.issuingAuthority,
    issueDate: c.issueDate,
    expiryDate: c.expiryDate,
    status: c.status,
  }));
};

// --- HR ----------------------------------------------------------------------

/** Employee-owned records reach their company through the employee. */
function employeeScopeWhere(ctx: ActorContext, filters: ReportFilters) {
  return {
    employee: {
      deletedAt: null,
      ...scopeWhere(ctx, filters),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    },
  };
}

const timesheetSummary: QueryFn = async (ctx, filters) => {
  const entries = await prisma.timesheetEntry.findMany({
    where: {
      ...employeeScopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...dateWindowOn("date", filters),
    },
    orderBy: [{ date: "desc" }],
    take: MAX_ROWS + 1,
    select: {
      date: true,
      normalHours: true,
      overtimeHours: true,
      delayedHours: true,
      absent: true,
      status: true,
      employee: {
        select: { employeeNo: true, fullName: true, company: { select: { code: true } } },
      },
    },
  });

  return entries.map((e) => ({
    employeeNo: e.employee.employeeNo,
    fullName: e.employee.fullName,
    company: e.employee.company.code,
    date: e.date,
    normalHours: e.normalHours.toString(),
    overtimeHours: e.overtimeHours.toString(),
    delayedHours: e.delayedHours.toString(),
    absent: e.absent ? "Yes" : "No",
    status: e.status,
  }));
};

const evaluationRegister: QueryFn = async (ctx, filters) => {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      ...employeeScopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...dateWindowOn("periodEnd", filters),
    },
    orderBy: [{ periodEnd: "desc" }],
    take: MAX_ROWS + 1,
    select: {
      periodStart: true,
      periodEnd: true,
      overallScore: true,
      status: true,
      employee: {
        select: { employeeNo: true, fullName: true, company: { select: { code: true } } },
      },
    },
  });

  return evaluations.map((e) => ({
    employeeNo: e.employee.employeeNo,
    fullName: e.employee.fullName,
    company: e.employee.company.code,
    periodStart: e.periodStart,
    periodEnd: e.periodEnd,
    overallScore: e.overallScore?.toString() ?? null,
    status: e.status,
  }));
};

const incrementRegister: QueryFn = async (ctx, filters) => {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const increments = await prisma.increment.findMany({
    where: {
      ...employeeScopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...dateWindowOn("effectiveDate", filters),
    },
    orderBy: [{ effectiveDate: "desc" }],
    take: MAX_ROWS + 1,
    select: {
      id: true,
      effectiveDate: true,
      currency: true,
      status: true,
      employee: {
        select: { employeeNo: true, fullName: true, company: { select: { code: true } } },
      },
    },
  });

  // The figures are a second, separately-gated query rather than a conditional
  // key on the first: an ungated select is one careless edit away from a leak.
  const figures = canSeeSalary
    ? new Map(
        (
          await prisma.increment.findMany({
            where: { id: { in: increments.map((i) => i.id) } },
            select: {
              id: true,
              currentSalary: true,
              newSalary: true,
              amount: true,
              percentage: true,
            },
          })
        ).map((i) => [i.id, i]),
      )
    : null;

  return increments.map((i) => {
    const f = figures?.get(i.id);
    return {
      employeeNo: i.employee.employeeNo,
      fullName: i.employee.fullName,
      company: i.employee.company.code,
      effectiveDate: i.effectiveDate,
      ...(figures
        ? {
            currentSalary: f?.currentSalary.toString() ?? null,
            newSalary: f?.newSalary.toString() ?? null,
            amount: f?.amount.toString() ?? null,
            percentage: f?.percentage.toString() ?? null,
          }
        : {}),
      currency: i.currency,
      status: i.status,
    };
  });
};

const warningRegister: QueryFn = async (ctx, filters) => {
  const warnings = await prisma.warningLetter.findMany({
    where: {
      ...employeeScopeWhere(ctx, filters),
      ...dateWindowOn("issuedDate", filters),
    },
    orderBy: [{ issuedDate: "desc" }],
    take: MAX_ROWS + 1,
    select: {
      level: true,
      reason: true,
      issuedDate: true,
      acknowledgedAt: true,
      employee: {
        select: { employeeNo: true, fullName: true, company: { select: { code: true } } },
      },
    },
  });

  return warnings.map((w) => ({
    employeeNo: w.employee.employeeNo,
    fullName: w.employee.fullName,
    company: w.employee.company.code,
    level: w.level,
    reason: w.reason,
    issuedDate: w.issuedDate,
    acknowledgedAt: w.acknowledgedAt,
  }));
};

const QUERIES: Record<ReportId, QueryFn> = {
  "employee-directory": employeeDirectory,
  "employee-headcount": employeeHeadcount,
  "joiners-leavers": joinersLeavers,
  "expiry-register": expiryRegister,
  "contract-register": contractRegister,
  "leave-register": leaveRegister,
  "it-asset-register": itAssetRegister,
  "helpdesk-tickets": helpdeskTickets,
  "fleet-register": fleetRegister,
  "insurance-register": insuranceRegister,
  "task-register": taskRegister,
  "letter-register": letterRegister,
  "petty-cash-ledger": pettyCashLedger,
  "accommodation-occupancy": accommodationOccupancy,
  "supplier-register": supplierRegister,
  "subcontractor-register": subcontractorRegister,
  "electricity-bills": electricityBills,
  "certificate-register": certificateRegister,
  "timesheet-summary": timesheetSummary,
  "evaluation-register": evaluationRegister,
  "increment-register": incrementRegister,
  "warning-register": warningRegister,
};
