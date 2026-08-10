import "server-only";
import type { EmployeeStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import {
  companyScopeWhere,
  departmentScopeWhere,
  requireCompanyAccess,
} from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import type {
  EmployeeInput,
  IqamaInput,
  PassportInput,
} from "@/lib/schemas/employee";
import { nextEmployeeNo } from "./counter";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Employee master record.
 *
 * Company scoping is applied INSIDE every query (docs/SECURITY.md §3): a KWI
 * user must never see an ICC employee, and filtering after the fact would break
 * counts and pagination as well as leaking row counts.
 */

const SORTABLE = ["fullName", "employeeNo", "joiningDate", "status"] as const;

export type EmployeeListRow = {
  id: string;
  employeeNo: string;
  fullName: string;
  status: EmployeeStatus;
  joiningDate: Date;
  nationality: string;
  companyCode: string;
  departmentName: string | null;
  positionTitle: string | null;
  iqamaExpiry: Date | null;
};

export type EmployeeFilters = {
  status?: string | undefined;
  companyId?: string | undefined;
  departmentId?: string | undefined;
};

export async function listEmployees(
  ctx: ActorContext,
  query: ListQuery,
  filters: EmployeeFilters = {},
): Promise<Paginated<EmployeeListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "fullName", direction: "asc" });

  const where: Prisma.EmployeeWhereInput = {
    ...companyScopeWhere(ctx),
    ...departmentScopeWhere(ctx),
    ...(filters.status ? { status: filters.status as EmployeeStatus } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" } },
            { employeeNo: { contains: query.q, mode: "insensitive" } },
            { workEmail: { contains: query.q, mode: "insensitive" } },
            { mobile: { contains: query.q } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        employeeNo: true,
        fullName: true,
        status: true,
        joiningDate: true,
        nationality: true,
        company: { select: { code: true } },
        department: { select: { name: true } },
        position: { select: { title: true } },
        iqama: { select: { expiryDate: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  return paginate(
    rows.map((e) => ({
      id: e.id,
      employeeNo: e.employeeNo,
      fullName: e.fullName,
      status: e.status,
      joiningDate: e.joiningDate,
      nationality: e.nationality,
      companyCode: e.company.code,
      departmentName: e.department?.name ?? null,
      positionTitle: e.position?.title ?? null,
      iqamaExpiry: e.iqama?.expiryDate ?? null,
    })),
    total,
    query,
  );
}

/** Loads an employee, enforcing company scope. */
export async function getEmployee(ctx: ActorContext, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      fullName: true,
      fullNameAr: true,
      gender: true,
      dateOfBirth: true,
      nationality: true,
      maritalStatus: true,
      status: true,
      employmentType: true,
      joiningDate: true,
      lastWorkingDate: true,
      mobile: true,
      workEmail: true,
      personalEmail: true,
      notes: true,
      companyId: true,
      departmentId: true,
      positionId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, code: true, name: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, title: true } },
      manager: { select: { id: true, fullName: true, employeeNo: true } },
      iqama: true,
      passport: true,
      emergencyContacts: true,
      userAccount: { select: { id: true, email: true, status: true } },
      _count: { select: { reports: true } },
    },
  });

  // Reported as "not found" rather than "forbidden" so an out-of-scope record's
  // existence cannot be probed.
  if (!employee) throw new NotFoundError("Employee not found.");
  return employee;
}

export type EmployeeDetail = Awaited<ReturnType<typeof getEmployee>>;

const fullNameOf = (first: string, last: string) => `${first} ${last}`.replace(/\s+/g, " ").trim();

export async function createEmployee(ctx: ActorContext, input: EmployeeInput) {
  requireCompanyAccess(ctx, input.companyId);
  await assertOrgReferencesValid(input);

  if (input.workEmail) {
    const clash = await prisma.employee.findFirst({
      where: { workEmail: input.workEmail },
      select: { id: true },
    });
    if (clash) throw new ConflictError("That work email is already in use.");
  }

  return prisma.$transaction(async (tx) => {
    const employeeNo = await nextEmployeeNo(tx);

    return tx.employee.create({
      data: {
        employeeNo,
        companyId: input.companyId,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        managerId: input.managerId ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: fullNameOf(input.firstName, input.lastName),
        fullNameAr: input.fullNameAr ?? null,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ?? null,
        nationality: input.nationality,
        maritalStatus: input.maritalStatus ?? null,
        status: input.status,
        employmentType: input.employmentType,
        joiningDate: input.joiningDate,
        lastWorkingDate: input.lastWorkingDate ?? null,
        mobile: input.mobile ?? null,
        workEmail: input.workEmail ?? null,
        personalEmail: input.personalEmail ?? null,
        notes: input.notes ?? null,
      },
      select: { id: true, employeeNo: true, fullName: true, companyId: true },
    });
  });
}

export async function updateEmployee(
  ctx: ActorContext,
  input: EmployeeInput & { id: string },
) {
  const before = await getEmployee(ctx, input.id);
  requireCompanyAccess(ctx, input.companyId);
  await assertOrgReferencesValid(input);

  if (input.managerId === input.id) {
    throw new ConflictError("An employee cannot report to themselves.");
  }
  if (input.managerId) await assertNotInReportingChain(input.id, input.managerId);

  if (input.workEmail && input.workEmail !== before.workEmail) {
    const clash = await prisma.employee.findFirst({
      where: { workEmail: input.workEmail, id: { not: input.id } },
      select: { id: true },
    });
    if (clash) throw new ConflictError("That work email is already in use.");
  }

  const fullName = fullNameOf(input.firstName, input.lastName);

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: input.id },
      data: {
        companyId: input.companyId,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        managerId: input.managerId ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        fullName,
        fullNameAr: input.fullNameAr ?? null,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ?? null,
        nationality: input.nationality,
        maritalStatus: input.maritalStatus ?? null,
        status: input.status,
        employmentType: input.employmentType,
        joiningDate: input.joiningDate,
        lastWorkingDate: input.lastWorkingDate ?? null,
        mobile: input.mobile ?? null,
        workEmail: input.workEmail ?? null,
        personalEmail: input.personalEmail ?? null,
        notes: input.notes ?? null,
      },
    });

    // The projection stores a human label, so a rename must refresh it or the
    // dashboard keeps showing the old name.
    if (fullName !== before.fullName || input.companyId !== before.companyId) {
      if (before.iqama) {
        await syncExpiry(
          {
            source: "IQAMA",
            sourceId: before.iqama.id,
            label: `Iqama — ${fullName}`,
            expiryDate: before.iqama.expiryDate,
            employeeId: input.id,
            companyId: input.companyId,
          },
          tx,
        );
      }
      if (before.passport) {
        await syncExpiry(
          {
            source: "PASSPORT",
            sourceId: before.passport.id,
            label: `Passport — ${fullName}`,
            expiryDate: before.passport.expiryDate,
            employeeId: input.id,
            companyId: input.companyId,
          },
          tx,
        );
      }
    }

    return updated;
  });

  return { before, after };
}

/** Status transition. An employee is never deleted through the UI (brief §50). */
export async function setEmployeeStatus(
  ctx: ActorContext,
  input: { id: string; status: EmployeeStatus; lastWorkingDate?: Date | undefined },
) {
  const before = await getEmployee(ctx, input.id);

  const leaving: EmployeeStatus[] = ["RESIGNED", "TERMINATED", "EXITED"];
  if (leaving.includes(input.status) && !input.lastWorkingDate && !before.lastWorkingDate) {
    throw new ConflictError("A last working date is required when an employee leaves.");
  }

  const after = await prisma.employee.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(input.lastWorkingDate ? { lastWorkingDate: input.lastWorkingDate } : {}),
    },
    select: { id: true, fullName: true, status: true, lastWorkingDate: true },
  });

  return {
    before: { status: before.status, lastWorkingDate: before.lastWorkingDate },
    after: { status: after.status, lastWorkingDate: after.lastWorkingDate },
    employee: after,
  };
}

// --- Iqama & passport --------------------------------------------------------

export async function upsertIqama(ctx: ActorContext, input: IqamaInput) {
  const employee = await getEmployee(ctx, input.employeeId);

  const clash = await prisma.iqamaRecord.findFirst({
    where: { iqamaNumber: input.iqamaNumber, employeeId: { not: input.employeeId } },
    select: { id: true },
  });
  if (clash) throw new ConflictError("That Iqama number belongs to another employee.");

  return prisma.$transaction(async (tx) => {
    const record = await tx.iqamaRecord.upsert({
      where: { employeeId: input.employeeId },
      create: {
        employeeId: input.employeeId,
        iqamaNumber: input.iqamaNumber,
        profession: input.profession,
        professionAr: input.professionAr ?? null,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        sponsorName: input.sponsorName ?? null,
        notes: input.notes ?? null,
      },
      update: {
        iqamaNumber: input.iqamaNumber,
        profession: input.profession,
        professionAr: input.professionAr ?? null,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        sponsorName: input.sponsorName ?? null,
        notes: input.notes ?? null,
      },
    });

    // Same transaction as the source write — ADR-005.
    await syncExpiry(
      {
        source: "IQAMA",
        sourceId: record.id,
        label: `Iqama — ${employee.fullName}`,
        expiryDate: record.expiryDate,
        employeeId: employee.id,
        companyId: employee.companyId,
      },
      tx,
    );

    return record;
  });
}

export async function upsertPassport(ctx: ActorContext, input: PassportInput) {
  const employee = await getEmployee(ctx, input.employeeId);

  return prisma.$transaction(async (tx) => {
    const record = await tx.passportRecord.upsert({
      where: { employeeId: input.employeeId },
      create: {
        employeeId: input.employeeId,
        passportNumber: input.passportNumber,
        issueCountry: input.issueCountry,
        issuePlace: input.issuePlace ?? null,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        notes: input.notes ?? null,
      },
      update: {
        passportNumber: input.passportNumber,
        issueCountry: input.issueCountry,
        issuePlace: input.issuePlace ?? null,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        notes: input.notes ?? null,
      },
    });

    await syncExpiry(
      {
        source: "PASSPORT",
        sourceId: record.id,
        label: `Passport — ${employee.fullName}`,
        expiryDate: record.expiryDate,
        employeeId: employee.id,
        companyId: employee.companyId,
      },
      tx,
    );

    return record;
  });
}

export async function removeIqama(ctx: ActorContext, employeeId: string) {
  const employee = await getEmployee(ctx, employeeId);
  if (!employee.iqama) throw new NotFoundError("No Iqama record to remove.");

  await prisma.$transaction(async (tx) => {
    await tx.iqamaRecord.delete({ where: { employeeId } });
    await deactivateExpiry("IQAMA", employee.iqama?.id ?? "", tx);
  });
}

// --- Helpers -----------------------------------------------------------------

/**
 * A department or position from another company would silently break scoping,
 * so cross-company references are rejected rather than normalised away.
 */
async function assertOrgReferencesValid(input: {
  companyId: string;
  departmentId?: string | undefined;
  positionId?: string | undefined;
  managerId?: string | undefined;
}) {
  if (input.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { companyId: true },
    });
    if (!department) throw new NotFoundError("Department not found.");
    if (department.companyId !== input.companyId) {
      throw new ConflictError("The department belongs to a different company.");
    }
  }

  if (input.positionId) {
    const position = await prisma.position.findUnique({
      where: { id: input.positionId },
      select: { companyId: true },
    });
    if (!position) throw new NotFoundError("Position not found.");
    if (position.companyId && position.companyId !== input.companyId) {
      throw new ConflictError("The position belongs to a different company.");
    }
  }

  if (input.managerId) {
    const manager = await prisma.employee.findUnique({
      where: { id: input.managerId },
      select: { companyId: true },
    });
    if (!manager) throw new NotFoundError("Manager not found.");
    if (manager.companyId !== input.companyId) {
      throw new ConflictError("The manager belongs to a different company.");
    }
  }
}

/** Prevents reporting cycles (A → B → A), which would hang the org chart. */
async function assertNotInReportingChain(employeeId: string, candidateManagerId: string) {
  let cursor: string | null = candidateManagerId;

  for (let depth = 0; cursor && depth < 30; depth += 1) {
    if (cursor === employeeId) {
      throw new ConflictError("That would create a circular reporting line.");
    }
    const manager: { managerId: string | null } | null = await prisma.employee.findUnique({
      where: { id: cursor },
      select: { managerId: true },
    });
    cursor = manager?.managerId ?? null;
  }
}

/** Candidate managers for the employee form, scoped and excluding self. */
export async function managerOptions(ctx: ActorContext, companyId: string, excludeId?: string) {
  if (!ctx.companyScope.includes?.(companyId) && ctx.companyScope !== "ALL") {
    throw new ForbiddenError("Record not found.");
  }

  return prisma.employee.findMany({
    where: {
      companyId,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, employeeNo: true },
  });
}
