import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere } from "@/server/auth/guards";
import { ForbiddenError } from "@/lib/result";
import { daysUntilExpiry } from "@/lib/expiry";
import { ASSET_STATUSES } from "@/lib/schemas/it";
import {
  expiryBucketLabel,
  isCompanyInScope,
  REPORTS,
  type ReportId,
  type ReportSpec,
} from "@/lib/reports";

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
      ...(filters.status && filters.status !== "ALL" ? { source: filters.status as "IQAMA" } : {}),
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
      ...dateWindowOn("startDate", filters),
    },
    orderBy: { startDate: "desc" },
    take: MAX_ROWS + 1,
    select: {
      startDate: true,
      endDate: true,
      days: true,
      leaveType: { select: { name: true } },
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

// --- Letters -----------------------------------------------------------------

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
          accommodation: {
            select: { name: true, city: true, company: { select: { code: true } } },
          },
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
  }));
};

// --- Registers added for the module-by-module report coverage ----------------

const jobOfferRegister: QueryFn = async (ctx, filters) => {
  // Salary is selected only when permitted, so an unauthorised run cannot even
  // fetch it — the column gate in the spec is the second line of defence, not
  // the only one.
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const offers = await prisma.jobOffer.findMany({
    where: {
      ...scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "DRAFT" } : {}),
      ...dateWindowOn("createdAt", filters),
      ...(filters.q
        ? {
            OR: [
              { candidateName: { contains: filters.q, mode: "insensitive" as const } },
              { candidateEmail: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS + 1,
    select: {
      candidateName: true,
      proposedSalary: canSeeSalary,
      currency: true,
      proposedJoiningDate: true,
      sentAt: true,
      status: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
    },
  });

  return offers.map((o) => ({
    candidate: o.candidateName,
    company: o.company.code,
    position: o.position?.title ?? null,
    salary:
      canSeeSalary && o.proposedSalary ? `${o.proposedSalary.toString()} ${o.currency}` : null,
    joiningDate: o.proposedJoiningDate,
    sentAt: o.sentAt,
    status: o.status,
  }));
};

const jobDescriptionRegister: QueryFn = async (ctx, filters) => {
  const rows = await prisma.jobDescription.findMany({
    where: {
      // Descriptions may be shared across companies, so the nullable-aware
      // helper applies. Composed under AND so the search OR cannot displace
      // the scope OR — the collision that made vault search run unscoped.
      AND: [
        filters.companyId ? scopeWhere(ctx, filters) : optionalCompanyScopeWhere(ctx),
        filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: "insensitive" as const } },
                { departmental: { contains: filters.q, mode: "insensitive" as const } },
              ],
            }
          : {},
      ],
    },
    orderBy: { title: "asc" },
    take: MAX_ROWS + 1,
    select: {
      title: true,
      version: true,
      isActive: true,
      updatedAt: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
    },
  });

  return rows.map((d) => ({
    title: d.title,
    company: d.company?.code ?? "All companies",
    position: d.position?.title ?? null,
    version: d.version,
    status: d.isActive ? "Active" : "Inactive",
    updatedAt: d.updatedAt,
  }));
};

const ipPhoneRegister: QueryFn = async (ctx, filters) => {
  // A phone belongs to the company that owns its handset; everything but the
  // extension is read from that asset.
  const status = (ASSET_STATUSES as readonly string[]).includes(filters.status ?? "")
    ? (filters.status as (typeof ASSET_STATUSES)[number])
    : undefined;
  // A status that is not an asset status matches nothing, rather than being
  // ignored and returning every row under a filter label that claims otherwise.
  if (filters.status && !status) return [];
  const rows = await prisma.ipPhone.findMany({
    where: {
      asset: { ...scopeWhere(ctx, filters), ...(status ? { status } : {}) },
      ...(filters.q
        ? {
            OR: [
              { extension: { contains: filters.q } },
              { asset: { assetCode: { contains: filters.q, mode: "insensitive" as const } } },
              { asset: { location: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { extension: "asc" },
    take: MAX_ROWS + 1,
    select: {
      extension: true,
      asset: {
        select: {
          assetCode: true,
          brand: true,
          model: true,
          macAddress: true,
          location: true,
          status: true,
          assignments: {
            where: { returnedAt: null },
            take: 1,
            select: { employee: { select: { fullName: true } } },
          },
        },
      },
    },
  });

  return rows.map((v) => ({
    extension: v.extension,
    employee: v.asset.assignments[0]?.employee.fullName ?? "— not assigned —",
    assetCode: v.asset.assetCode,
    deviceModel: `${v.asset.brand} ${v.asset.model}`,
    macAddress: v.asset.macAddress,
    location: v.asset.location,
    status: v.asset.status,
  }));
};

const cctvRegister: QueryFn = async (ctx, filters) => {
  // The hardware fields come from the linked asset; status is the asset's.
  const status = (ASSET_STATUSES as readonly string[]).includes(filters.status ?? "")
    ? (filters.status as (typeof ASSET_STATUSES)[number])
    : undefined;
  if (filters.status && !status) return [];

  const rows = await prisma.cctvDevice.findMany({
    where: {
      asset: { ...scopeWhere(ctx, filters), ...(status ? { status } : {}) },
      ...(filters.q
        ? {
            OR: [
              { asset: { assetCode: { contains: filters.q, mode: "insensitive" as const } } },
              { asset: { brand: { contains: filters.q, mode: "insensitive" as const } } },
              { asset: { location: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ asset: { location: "asc" } }, { asset: { assetCode: "asc" } }],
    take: MAX_ROWS + 1,
    select: {
      type: true,
      lastMaintenanceAt: true,
      asset: {
        select: {
          assetCode: true,
          brand: true,
          model: true,
          location: true,
          ipAddress: true,
          status: true,
          company: { select: { code: true } },
        },
      },
      recorder: { select: { asset: { select: { assetCode: true } } } },
    },
  });

  return rows.map((v) => ({
    name: `${v.asset.brand} ${v.asset.model}`,
    assetCode: v.asset.assetCode,
    company: v.asset.company.code,
    type: v.type,
    location: v.asset.location,
    ipAddress: v.asset.ipAddress,
    recorder: v.recorder?.asset.assetCode ?? null,
    lastMaintenanceAt: v.lastMaintenanceAt,
    status: v.asset.status,
  }));
};

const vehicleMaintenanceRegister: QueryFn = async (ctx, filters) => {
  const rows = await prisma.vehicleMaintenance.findMany({
    where: {
      vehicle: scopeWhere(ctx, filters),
      ...(filters.status ? { status: filters.status as "APPROVED" } : {}),
      ...dateWindowOn("date", filters),
      ...(filters.q
        ? {
            OR: [
              { description: { contains: filters.q, mode: "insensitive" as const } },
              { workshop: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { date: "desc" },
    take: MAX_ROWS + 1,
    select: {
      date: true,
      type: true,
      description: true,
      workshop: true,
      cost: true,
      currency: true,
      nextDueDate: true,
      status: true,
      vehicle: { select: { make: true, model: true, plateNumber: true } },
    },
  });

  return rows.map((m) => ({
    vehicle: `${m.vehicle.make} ${m.vehicle.model}`,
    plateNumber: m.vehicle.plateNumber,
    date: m.date,
    type: m.type,
    description: m.description,
    workshop: m.workshop,
    cost: m.cost ? `${m.cost.toString()} ${m.currency}` : null,
    nextDueDate: m.nextDueDate,
    status: m.status,
  }));
};

const vehicleHandoverRegister: QueryFn = async (ctx, filters) => {
  const rows = await prisma.vehicleHandover.findMany({
    where: {
      vehicle: scopeWhere(ctx, filters),
      ...dateWindowOn("handoverDate", filters),
      ...(filters.q
        ? { vehicle: { plateNumber: { contains: filters.q, mode: "insensitive" as const } } }
        : {}),
    },
    orderBy: { handoverDate: "desc" },
    take: MAX_ROWS + 1,
    select: {
      handoverDate: true,
      mileage: true,
      fuelLevel: true,
      condition: true,
      acknowledgedAt: true,
      vehicle: { select: { make: true, model: true, plateNumber: true } },
      fromEmployee: { select: { fullName: true } },
      toEmployee: { select: { fullName: true } },
    },
  });

  return rows.map((h) => ({
    vehicle: `${h.vehicle.make} ${h.vehicle.model}`,
    plateNumber: h.vehicle.plateNumber,
    handoverDate: h.handoverDate,
    fromEmployee: h.fromEmployee?.fullName ?? "— store —",
    toEmployee: h.toEmployee?.fullName ?? "— store —",
    mileage: h.mileage,
    fuelLevel: h.fuelLevel,
    condition: h.condition,
    acknowledged: h.acknowledgedAt ? "Yes" : "No",
  }));
};

const userRegister: QueryFn = async (ctx, filters) => {
  void ctx;
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { email: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: MAX_ROWS + 1,
    select: {
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      role: { select: { name: true } },
      companyAccess: { select: { company: { select: { code: true } } } },
    },
  });

  return rows.map((u) => ({
    name: u.name,
    email: u.email,
    role: u.role.name,
    companies:
      u.companyAccess.length === 0
        ? "All companies"
        : u.companyAccess.map((a) => a.company.code).join(", "),
    status: u.status,
    lastLoginAt: u.lastLoginAt,
  }));
};

const roleRegister: QueryFn = async (ctx, filters) => {
  void ctx;
  void filters;
  const rows = await prisma.role.findMany({
    orderBy: { rank: "asc" },
    select: {
      key: true,
      name: true,
      description: true,
      rank: true,
      isSystem: true,
      _count: { select: { permissions: true, users: true } },
    },
  });

  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    rank: r.rank,
    isSystem: r.isSystem ? "Yes" : "No",
    // SUPER_ADMIN holds every permission implicitly rather than by grant rows,
    // so the raw count would read 0 and imply it can do nothing.
    permissions: r.key === "SUPER_ADMIN" ? "All" : r._count.permissions,
    users: r._count.users,
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
  "fleet-register": fleetRegister,
  "insurance-register": insuranceRegister,
  "letter-register": letterRegister,
  "accommodation-occupancy": accommodationOccupancy,
  "subcontractor-register": subcontractorRegister,
  "certificate-register": certificateRegister,
  "warning-register": warningRegister,
  "job-offer-register": jobOfferRegister,
  "job-description-register": jobDescriptionRegister,
  "ip-phone-register": ipPhoneRegister,
  "cctv-register": cctvRegister,
  "vehicle-maintenance": vehicleMaintenanceRegister,
  "vehicle-handover": vehicleHandoverRegister,
  "user-register": userRegister,
  "role-register": roleRegister,
};
