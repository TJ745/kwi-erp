import "server-only";
import type { EmployeeStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { describeIbanProblem, validateIban } from "@/lib/bank";
import {
  decideBankRead,
  decideBankWrite,
  describeBankDenial,
} from "@/lib/bank-access";
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
  BankDetailInput,
} from "@/lib/schemas/employee";
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
      middleName: true,
      lastName: true,
      familyName: true,
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

/**
 * Refuses an employee number another record already holds.
 *
 * The column is unique, so the database would refuse it anyway — but as a
 * constraint violation, which reaches the form as "something went wrong".
 * Checked here so the message can say who has it. Soft-deleted records count:
 * numbers are never recycled, and a departed employee's number reappearing on
 * someone else would confuse every document that still carries it.
 */
export async function assertEmployeeNoFree(employeeNo: string, exceptId?: string): Promise<void> {
  const holder = await prisma.employee.findFirst({
    where: { employeeNo, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { fullName: true, deletedAt: true },
  });
  if (holder) {
    throw new ConflictError(
      holder.deletedAt
        ? `Employee ID ${employeeNo} belonged to ${holder.fullName}, whose record is archived. Numbers are not reused.`
        : `Employee ID ${employeeNo} is already used by ${holder.fullName}.`,
    );
  }
}

export async function createEmployee(ctx: ActorContext, input: EmployeeInput) {
  requireCompanyAccess(ctx, input.companyId);
  await assertOrgReferencesValid(input);
  await assertEmployeeNoFree(input.employeeNo);

  if (input.workEmail) {
    const clash = await prisma.employee.findFirst({
      where: { workEmail: input.workEmail },
      select: { id: true },
    });
    if (clash) throw new ConflictError("That work email is already in use.");
  }

  return prisma.$transaction(async (tx) => {
    return tx.employee.create({
      data: {
        employeeNo: input.employeeNo,
        companyId: input.companyId,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        managerId: input.managerId ?? null,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        familyName: input.familyName ?? null,
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

  // A number typed wrongly at creation can be corrected here; the audit diff
  // records the change, and the old value stays visible in that history.
  if (input.employeeNo !== before.employeeNo) {
    await assertEmployeeNoFree(input.employeeNo, input.id);
  }

  const fullName = fullNameOf(input.firstName, input.lastName);

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: input.id },
      data: {
        employeeNo: input.employeeNo,
        companyId: input.companyId,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        managerId: input.managerId ?? null,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        familyName: input.familyName ?? null,
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
/**
 * Candidate managers, searched server-side.
 *
 * `q` exists so the picker can query as the user types instead of shipping
 * every employee to the browser. The cap is 20 rather than 500 for the same
 * reason: a list nobody can scan is not more useful for being longer, and the
 * search is what narrows it.
 */
export async function managerOptions(
  ctx: ActorContext,
  companyId: string,
  excludeId?: string,
  q?: string,
) {
  if (!ctx.companyScope.includes?.(companyId) && ctx.companyScope !== "ALL") {
    throw new ForbiddenError("Record not found.");
  }

  return prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { employeeNo: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: "asc" },
    take: 20,
    select: { id: true, fullName: true, employeeNo: true },
  });
}

// --- Iqama renewals ----------------------------------------------------------

/**
 * Opens a renewal against the employee's current Iqama.
 *
 * `previousExpiry` is captured now, from the record, rather than supplied by
 * the caller: it is the date the renewal is replacing, and taking it from the
 * request would let the history record a date that was never true.
 *
 * One open renewal at a time. Two would leave it ambiguous which one a
 * completion applies to, and the Iqama page would show two conflicting states.
 */
export async function startIqamaRenewal(
  ctx: ActorContext,
  input: { employeeId: string; notes?: string | undefined },
) {
  const employee = await getEmployee(ctx, input.employeeId);
  if (!employee.iqama) {
    throw new ConflictError("Record the Iqama before starting a renewal.");
  }

  const open = await prisma.iqamaRenewal.findFirst({
    where: {
      iqamaRecordId: employee.iqama.id,
      status: { notIn: ["COMPLETED", "REJECTED"] },
    },
    select: { id: true },
  });
  if (open) throw new ConflictError("A renewal is already open for this Iqama.");

  return prisma.$transaction(async (tx) => {
    const renewal = await tx.iqamaRenewal.create({
      data: {
        iqamaRecordId: employee.iqama!.id,
        previousExpiry: employee.iqama!.expiryDate,
        status: "IN_PROGRESS",
        notes: input.notes ?? null,
      },
      select: { id: true, previousExpiry: true, status: true },
    });

    // The record's own flag drives the Iqama page's buckets, so it moves with
    // the renewal rather than being derived by a second query.
    await tx.iqamaRecord.update({
      where: { id: employee.iqama!.id },
      data: { renewalStatus: "IN_PROGRESS" },
    });

    return { renewal, employee };
  });
}

/**
 * Advances or closes a renewal.
 *
 * Completing one is the only path that moves `IqamaRecord.expiryDate`. The new
 * date and the ExpiryIndex row are written in the same transaction (ADR-005),
 * so the register can never disagree with the record — the reconciler would
 * eventually fix a drift, but "eventually" is a night away and the expiry
 * buckets are what people act on.
 */
export async function updateIqamaRenewal(
  ctx: ActorContext,
  input: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "COMPLETED" | "REJECTED";
    submittedAt?: Date | undefined;
    newExpiry?: Date | undefined;
    notes?: string | undefined;
  },
) {
  const renewal = await prisma.iqamaRenewal.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      status: true,
      previousExpiry: true,
      iqamaRecord: { select: { id: true, employeeId: true, expiryDate: true } },
    },
  });
  if (!renewal) throw new NotFoundError("Renewal not found.");

  // Scope is checked through the employee, which is where company lives.
  const employee = await getEmployee(ctx, renewal.iqamaRecord.employeeId);

  if (renewal.status === "COMPLETED") {
    throw new ConflictError("This renewal is already completed.");
  }

  if (input.status === "COMPLETED") {
    if (!input.newExpiry) {
      throw new ConflictError("A new expiry date is required to complete a renewal.");
    }
    if (input.newExpiry.getTime() <= renewal.previousExpiry.getTime()) {
      throw new ConflictError("The new expiry must be later than the previous one.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.iqamaRenewal.update({
      where: { id: input.id },
      data: {
        status: input.status,
        ...(input.submittedAt ? { submittedAt: input.submittedAt } : {}),
        ...(input.status === "SUBMITTED" && !input.submittedAt
          ? { submittedAt: new Date() }
          : {}),
        ...(input.newExpiry ? { newExpiry: input.newExpiry } : {}),
        ...(input.status === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
      },
      select: { id: true, status: true, newExpiry: true, previousExpiry: true },
    });

    await tx.iqamaRecord.update({
      where: { id: renewal.iqamaRecord.id },
      data: {
        renewalStatus: input.status,
        ...(input.status === "COMPLETED" && input.newExpiry
          ? { expiryDate: input.newExpiry }
          : {}),
      },
    });

    if (input.status === "COMPLETED" && input.newExpiry) {
      await syncExpiry(
        {
          source: "IQAMA",
          sourceId: renewal.iqamaRecord.id,
          label: `Iqama — ${employee.fullName}`,
          expiryDate: input.newExpiry,
          employeeId: employee.id,
          companyId: employee.companyId,
        },
        tx,
      );
    }

    return { renewal: after, employee, previousStatus: renewal.status };
  });
}

/** Renewal history for one Iqama, newest first. */
export async function iqamaRenewals(ctx: ActorContext, employeeId: string) {
  const employee = await getEmployee(ctx, employeeId);
  if (!employee.iqama) return [];

  return prisma.iqamaRenewal.findMany({
    where: { iqamaRecordId: employee.iqama.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      previousExpiry: true,
      newExpiry: true,
      submittedAt: true,
      completedAt: true,
      status: true,
      notes: true,
    },
  });
}

// --- Emergency contacts ------------------------------------------------------

/**
 * Next of kin. Read through `getEmployee` already, but there was no way to
 * write one — the relation was included in the profile query and then never
 * rendered, so the data was fetched and discarded.
 */
export async function listEmergencyContacts(ctx: ActorContext, employeeId: string) {
  await getEmployee(ctx, employeeId);

  return prisma.emergencyContact.findMany({
    where: { employeeId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      relation: true,
      phone: true,
      altPhone: true,
      address: true,
    },
  });
}

export async function createEmergencyContact(
  ctx: ActorContext,
  input: {
    employeeId: string;
    name: string;
    relation: string;
    phone: string;
    altPhone?: string | undefined;
    address?: string | undefined;
  },
) {
  const employee = await getEmployee(ctx, input.employeeId);

  const contact = await prisma.emergencyContact.create({
    data: {
      employeeId: input.employeeId,
      name: input.name,
      relation: input.relation,
      phone: input.phone,
      altPhone: input.altPhone ?? null,
      address: input.address ?? null,
    },
    select: { id: true, name: true, relation: true },
  });

  return { contact, employee };
}

export async function updateEmergencyContact(
  ctx: ActorContext,
  input: {
    id: string;
    employeeId: string;
    name: string;
    relation: string;
    phone: string;
    altPhone?: string | undefined;
    address?: string | undefined;
  },
) {
  const employee = await getEmployee(ctx, input.employeeId);

  // Scoped by employee as well as id: an id alone would let a contact be moved
  // or edited across companies by guessing it.
  const before = await prisma.emergencyContact.findFirst({
    where: { id: input.id, employeeId: input.employeeId },
    select: { id: true, name: true, relation: true, phone: true },
  });
  if (!before) throw new NotFoundError("Emergency contact not found.");

  const after = await prisma.emergencyContact.update({
    where: { id: input.id },
    data: {
      name: input.name,
      relation: input.relation,
      phone: input.phone,
      altPhone: input.altPhone ?? null,
      address: input.address ?? null,
    },
    select: { id: true, name: true, relation: true, phone: true },
  });

  return { before, after, employee };
}

export async function deleteEmergencyContact(
  ctx: ActorContext,
  input: { id: string; employeeId: string },
) {
  const employee = await getEmployee(ctx, input.employeeId);

  const contact = await prisma.emergencyContact.findFirst({
    where: { id: input.id, employeeId: input.employeeId },
    select: { id: true, name: true },
  });
  if (!contact) throw new NotFoundError("Emergency contact not found.");

  await prisma.emergencyContact.delete({ where: { id: contact.id } });
  return { contact, employee };
}

// --- Bank details ------------------------------------------------------------

/**
 * Payroll bank details.
 *
 * Gated on `employees.bank.view` in the service, not only at the call site.
 * `employees.view` is broad and `employees.bank.view` is sensitive precisely
 * because holding one must not imply the other — and an ungated read sitting
 * ready to be wired up is how the increments-table leak happened (SECURITY §12).
 */
export async function bankDetailFor(ctx: ActorContext, employeeId: string) {
  await getEmployee(ctx, employeeId);

  const decision = decideBankRead(ctx.permissions);
  if (!decision.allowed) throw new ForbiddenError(describeBankDenial(decision.reason));

  return prisma.employeeBankDetail.findUnique({
    where: { employeeId },
    select: {
      id: true,
      bankName: true,
      iban: true,
      accountNo: true,
      swift: true,
      verifiedAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Creates or replaces the bank details.
 *
 * Changing an IBAN invalidates any previous verification: whoever confirmed the
 * old account did not confirm this one, and leaving the tick in place would
 * mean a changed account looks checked when nobody has checked it.
 */
export async function upsertBankDetail(ctx: ActorContext, input: BankDetailInput) {
  const employee = await getEmployee(ctx, input.employeeId);

  const decision = decideBankWrite(ctx.permissions);
  if (!decision.allowed) throw new ForbiddenError(describeBankDenial(decision.reason));

  const check = validateIban(input.iban);
  if (!check.ok) {
    // The schema checks this too; a direct service call must not bypass it.
    throw new ConflictError(describeIbanProblem(check.problem));
  }

  const before = await prisma.employeeBankDetail.findUnique({
    where: { employeeId: input.employeeId },
    select: { iban: true, bankName: true, verifiedAt: true },
  });

  const ibanChanged = before !== null && before.iban !== check.iban;

  const after = await prisma.employeeBankDetail.upsert({
    where: { employeeId: input.employeeId },
    create: {
      employeeId: input.employeeId,
      bankName: input.bankName,
      iban: check.iban,
      accountNo: input.accountNo ?? null,
      swift: input.swift ?? null,
      verifiedAt: input.verifiedAt ?? null,
    },
    update: {
      bankName: input.bankName,
      iban: check.iban,
      accountNo: input.accountNo ?? null,
      swift: input.swift ?? null,
      verifiedAt: ibanChanged ? null : (input.verifiedAt ?? null),
    },
    select: { id: true, bankName: true, iban: true, verifiedAt: true },
  });

  // Reported so the audit entry can say the actor overwrote an IBAN they were
  // not permitted to read — allowed, but worth recording.
  return { before, after, employee, ibanChanged, blindWrite: decision.blindWrite };
}

export async function deleteBankDetail(ctx: ActorContext, employeeId: string) {
  const employee = await getEmployee(ctx, employeeId);

  const deletion = decideBankWrite(ctx.permissions);
  if (!deletion.allowed) throw new ForbiddenError(describeBankDenial(deletion.reason));

  const existing = await prisma.employeeBankDetail.findUnique({
    where: { employeeId },
    select: { id: true, bankName: true },
  });
  if (!existing) throw new NotFoundError("No bank details to remove.");

  await prisma.employeeBankDetail.delete({ where: { employeeId } });
  return { employee, bankName: existing.bankName };
}
