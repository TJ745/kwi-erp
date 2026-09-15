import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import {
  companyScopeWhere,
  optionalCompanyScopeWhere,
  requireCompanyAccess,
} from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { summarise, validateHours, type TimesheetDay } from "@/lib/timesheet";
import type {
  JobDescriptionInput,
  JobOfferInput,
  TimesheetEntryInput,
} from "@/lib/schemas/hiring";
import { assertEmployeeNoFree } from "./employees";

/**
 * Hiring and timesheets — brief §17, §18, §23.
 *
 * The load-bearing operation here is converting an accepted offer into an
 * employee: it is the one place this system creates a person, and doing it
 * twice would produce a duplicate employee record that payroll would pay.
 */

// --- Job descriptions --------------------------------------------------------

export async function listJobDescriptions(
  ctx: ActorContext,
  filters: { q?: string | undefined } = {},
) {
  return prisma.jobDescription.findMany({
    where: {
      // Company-optional: a shared description is visible to everyone.
      ...optionalCompanyScopeWhere(ctx),
      ...(filters.q
        ? { title: { contains: filters.q, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      responsibilities: true,
      requirements: true,
      isActive: true,
      version: true,
      companyId: true,
      positionId: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
      _count: { select: { jobOffers: true } },
    },
  });
}

export async function createJobDescription(
  ctx: ActorContext,
  input: JobDescriptionInput,
) {
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);

  return prisma.jobDescription.create({
    data: {
      companyId: input.companyId ?? null,
      positionId: input.positionId ?? null,
      title: input.title,
      summary: input.summary ?? null,
      responsibilities: input.responsibilities ?? null,
      requirements: input.requirements ?? null,
      isActive: input.isActive,
    },
    select: { id: true, title: true, companyId: true, version: true },
  });
}

export async function updateJobDescription(
  ctx: ActorContext,
  input: JobDescriptionInput & { id: string },
) {
  const before = await prisma.jobDescription.findFirst({
    where: { id: input.id, ...optionalCompanyScopeWhere(ctx) },
    select: { id: true, title: true, isActive: true, version: true, companyId: true },
  });
  if (!before) throw new NotFoundError("Job description not found.");
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);

  const after = await prisma.jobDescription.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId ?? null,
      positionId: input.positionId ?? null,
      title: input.title,
      summary: input.summary ?? null,
      responsibilities: input.responsibilities ?? null,
      requirements: input.requirements ?? null,
      isActive: input.isActive,
      // Offers already made keep pointing at this row, so the version is what
      // distinguishes "the description as it was quoted" from today's text.
      version: { increment: 1 },
    },
    select: { id: true, title: true, isActive: true, version: true, companyId: true },
  });

  return { before, after };
}

export async function deleteJobDescription(ctx: ActorContext, id: string) {
  const description = await prisma.jobDescription.findFirst({
    where: { id, ...optionalCompanyScopeWhere(ctx) },
    select: {
      id: true,
      title: true,
      companyId: true,
      _count: { select: { jobOffers: true } },
    },
  });
  if (!description) throw new NotFoundError("Job description not found.");
  if (description._count.jobOffers > 0) {
    throw new ConflictError(
      `${description._count.jobOffers} offer(s) reference this description. Deactivate it instead.`,
    );
  }

  await prisma.jobDescription.delete({ where: { id } });
  return description;
}

// --- Job offers --------------------------------------------------------------

export async function listJobOffers(
  ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
) {
  return prisma.jobOffer.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "DRAFT" } : {}),
      ...(filters.q
        ? { candidateName: { contains: filters.q, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      candidatePhone: true,
      proposedSalary: true,
      currency: true,
      proposedJoiningDate: true,
      status: true,
      sentAt: true,
      decidedAt: true,
      convertedEmployeeId: true,
      notes: true,
      companyId: true,
      positionId: true,
      jobDescriptionId: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
      convertedEmployee: { select: { id: true, employeeNo: true, fullName: true } },
    },
  });
}

export async function createJobOffer(ctx: ActorContext, input: JobOfferInput) {
  requireCompanyAccess(ctx, input.companyId);

  return prisma.jobOffer.create({
    data: {
      companyId: input.companyId,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail ?? null,
      candidatePhone: input.candidatePhone ?? null,
      positionId: input.positionId ?? null,
      jobDescriptionId: input.jobDescriptionId ?? null,
      proposedSalary: input.proposedSalary ?? null,
      currency: input.currency,
      proposedJoiningDate: input.proposedJoiningDate ?? null,
      status: input.status as "DRAFT",
      sentAt: input.sentAt ?? null,
      notes: input.notes ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, candidateName: true, status: true, companyId: true },
  });
}

export async function updateJobOffer(
  ctx: ActorContext,
  input: JobOfferInput & { id: string },
) {
  const before = await prisma.jobOffer.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      candidateName: true,
      status: true,
      proposedSalary: true,
      companyId: true,
      convertedEmployeeId: true,
    },
  });
  if (!before) throw new NotFoundError("Offer not found.");
  requireCompanyAccess(ctx, input.companyId);

  // Once an offer produced an employee, its terms are what that person was
  // hired on. Editing them afterwards rewrites history.
  if (before.convertedEmployeeId) {
    throw new ConflictError(
      "This offer has been converted into an employee and can no longer be edited.",
    );
  }

  const decided =
    input.status === "ACCEPTED" ||
    input.status === "DECLINED" ||
    input.status === "WITHDRAWN";

  const after = await prisma.jobOffer.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail ?? null,
      candidatePhone: input.candidatePhone ?? null,
      positionId: input.positionId ?? null,
      jobDescriptionId: input.jobDescriptionId ?? null,
      proposedSalary: input.proposedSalary ?? null,
      currency: input.currency,
      proposedJoiningDate: input.proposedJoiningDate ?? null,
      status: input.status as "DRAFT",
      sentAt: input.sentAt ?? null,
      notes: input.notes ?? null,
      ...(decided && before.status !== input.status ? { decidedAt: new Date() } : {}),
    },
    select: { id: true, candidateName: true, status: true, companyId: true },
  });

  return { before, after };
}

/**
 * Turns an accepted offer into an employee.
 *
 * Guarded three ways because a duplicate employee is a person payroll pays
 * twice:
 *
 *   1. only an ACCEPTED offer converts;
 *   2. an offer that already has convertedEmployeeId is refused;
 *   3. the employee create and the offer update share one transaction, so a
 *      failure cannot leave an employee with no offer pointing at them.
 */
export async function convertOffer(
  ctx: ActorContext,
  input: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    gender: "MALE" | "FEMALE";
    nationality: string;
    joiningDate: Date;
    employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "TEMPORARY";
    departmentId?: string | undefined;
  },
) {
  const offer = await prisma.jobOffer.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      candidatePhone: true,
      companyId: true,
      positionId: true,
      status: true,
      convertedEmployeeId: true,
      proposedSalary: true,
      currency: true,
    },
  });
  if (!offer) throw new NotFoundError("Offer not found.");

  if (offer.convertedEmployeeId) {
    throw new ConflictError("This offer has already been converted into an employee.");
  }
  if (offer.status !== "ACCEPTED") {
    throw new ConflictError(
      `Only an accepted offer can be converted; this one is ${offer.status.toLowerCase()}.`,
    );
  }

  if (input.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: input.departmentId, companyId: offer.companyId },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundError("Department not found in the offer's company.");
    }
  }

  await assertEmployeeNoFree(input.employeeNo);

  try {
    return await prisma.$transaction(async (tx) => {
      const fullName = `${input.firstName} ${input.lastName}`;

      const employee = await tx.employee.create({
        data: {
          employeeNo: input.employeeNo,
          companyId: offer.companyId,
          departmentId: input.departmentId ?? null,
          positionId: offer.positionId,
          firstName: input.firstName,
          lastName: input.lastName,
          fullName,
          gender: input.gender,
          nationality: input.nationality,
          status: "ACTIVE",
          employmentType: input.employmentType,
          joiningDate: input.joiningDate,
          personalEmail: offer.candidateEmail,
          mobile: offer.candidatePhone,
        },
        select: { id: true, employeeNo: true, fullName: true },
      });

      await tx.jobOffer.update({
        where: { id: offer.id },
        data: {
          status: "CONVERTED",
          convertedEmployeeId: employee.id,
          decidedAt: new Date(),
        },
      });

      return {
        employee,
        offerId: offer.id,
        candidateName: offer.candidateName,
        companyId: offer.companyId,
        proposedSalary: offer.proposedSalary?.toString() ?? null,
        currency: offer.currency,
      };
    });
  } catch (error) {
    // workEmail is unique; a candidate re-entered with a colliding value
    // should read as a conflict, not a 500.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        "An employee with those details already exists. Check the directory before converting.",
      );
    }
    throw error;
  }
}

export async function deleteJobOffer(ctx: ActorContext, id: string) {
  const offer = await prisma.jobOffer.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      candidateName: true,
      companyId: true,
      convertedEmployeeId: true,
    },
  });
  if (!offer) throw new NotFoundError("Offer not found.");
  if (offer.convertedEmployeeId) {
    throw new ConflictError(
      "This offer produced an employee record and cannot be deleted.",
    );
  }

  await prisma.jobOffer.delete({ where: { id } });
  return offer;
}

export async function offerCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const [open, accepted, converted] = await Promise.all([
    prisma.jobOffer.count({ where: { status: { in: ["DRAFT", "SENT"] }, ...scope } }),
    prisma.jobOffer.count({ where: { status: "ACCEPTED", ...scope } }),
    prisma.jobOffer.count({ where: { status: "CONVERTED", ...scope } }),
  ]);
  return { open, accepted, converted };
}

// --- Timesheets --------------------------------------------------------------

function employeeScope(ctx: ActorContext) {
  return { employee: { ...companyScopeWhere(ctx), deletedAt: null } };
}

export async function listTimesheet(
  ctx: ActorContext,
  filters: { employeeId?: string | undefined; from?: Date | undefined; to?: Date | undefined },
) {
  const entries = await prisma.timesheetEntry.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "desc" }],
    take: 500,
    select: {
      id: true,
      date: true,
      normalHours: true,
      overtimeHours: true,
      delayedHours: true,
      absent: true,
      status: true,
      notes: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeNo: true,
          company: { select: { code: true } },
        },
      },
    },
  });

  const days: TimesheetDay[] = entries.map((e) => ({
    normalHours: e.normalHours.toString(),
    overtimeHours: e.overtimeHours.toString(),
    delayedHours: e.delayedHours.toString(),
    absent: e.absent,
    status: e.status,
  }));

  return { entries, summary: summarise(days) };
}

export async function createTimesheetEntry(
  ctx: ActorContext,
  input: TimesheetEntryInput,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  // Same rules the form applies, enforced where they cannot be skipped.
  const problems = validateHours(input);
  if (problems.length > 0) {
    throw new ConflictError(problems[0]?.message ?? "Invalid hours.");
  }

  try {
    const entry = await prisma.timesheetEntry.create({
      data: {
        employeeId: input.employeeId,
        date: input.date,
        normalHours: input.normalHours,
        overtimeHours: input.overtimeHours,
        delayedHours: input.delayedHours,
        absent: input.absent,
        notes: input.notes ?? null,
        status: "PENDING",
      },
      select: { id: true, date: true, normalHours: true, overtimeHours: true },
    });

    return { ...entry, employeeName: employee.fullName, companyId: employee.companyId };
  } catch (error) {
    // @@unique([employeeId, date]) — one row per person per day.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        `${employee.fullName} already has an entry for ${input.date.toISOString().slice(0, 10)}. Edit that one instead.`,
      );
    }
    throw error;
  }
}

export async function updateTimesheetEntry(
  ctx: ActorContext,
  input: TimesheetEntryInput & { id: string },
) {
  const before = await prisma.timesheetEntry.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      date: true,
      normalHours: true,
      overtimeHours: true,
      delayedHours: true,
      absent: true,
      status: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!before) throw new NotFoundError("Entry not found.");

  // Approved hours have been signed off for payroll.
  if (before.status !== "PENDING") {
    throw new ConflictError(
      `This entry is ${before.status.toLowerCase()} and can no longer be edited.`,
    );
  }

  const problems = validateHours(input);
  if (problems.length > 0) {
    throw new ConflictError(problems[0]?.message ?? "Invalid hours.");
  }

  const after = await prisma.timesheetEntry.update({
    where: { id: input.id },
    data: {
      date: input.date,
      normalHours: input.normalHours,
      overtimeHours: input.overtimeHours,
      delayedHours: input.delayedHours,
      absent: input.absent,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      date: true,
      normalHours: true,
      overtimeHours: true,
      delayedHours: true,
      absent: true,
    },
  });

  return {
    before: {
      normalHours: before.normalHours.toString(),
      overtimeHours: before.overtimeHours.toString(),
      absent: before.absent,
    },
    after: {
      id: after.id,
      normalHours: after.normalHours.toString(),
      overtimeHours: after.overtimeHours.toString(),
      absent: after.absent,
    },
    employeeName: before.employee.fullName,
    companyId: before.employee.companyId,
  };
}

export async function decideTimesheetEntry(
  ctx: ActorContext,
  input: { id: string; decision: "APPROVED" | "REJECTED" },
) {
  const entry = await prisma.timesheetEntry.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      date: true,
      status: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!entry) throw new NotFoundError("Entry not found.");
  if (entry.status !== "PENDING") {
    throw new ConflictError(`Already ${entry.status.toLowerCase()}.`);
  }

  await prisma.timesheetEntry.update({
    where: { id: input.id },
    data: { status: input.decision, approvedById: ctx.userId, approvedAt: new Date() },
  });

  return {
    id: entry.id,
    date: entry.date,
    employeeName: entry.employee.fullName,
    companyId: entry.employee.companyId,
    before: entry.status,
    after: input.decision,
  };
}

/** Approves every pending day in a period — the end-of-month action. */
export async function approvePeriod(
  ctx: ActorContext,
  input: { employeeId: string; from: Date; to: Date },
) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  const { count } = await prisma.timesheetEntry.updateMany({
    where: {
      employeeId: input.employeeId,
      status: "PENDING",
      date: { gte: input.from, lte: input.to },
    },
    data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
  });

  if (count === 0) {
    throw new ConflictError("No pending entries in that period.");
  }

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    companyId: employee.companyId,
    approved: count,
  };
}

export async function deleteTimesheetEntry(ctx: ActorContext, id: string) {
  const entry = await prisma.timesheetEntry.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      date: true,
      status: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!entry) throw new NotFoundError("Entry not found.");
  if (entry.status === "APPROVED") {
    throw new ConflictError(
      "An approved entry has been signed off for payroll and cannot be deleted.",
    );
  }

  await prisma.timesheetEntry.delete({ where: { id } });
  return {
    id: entry.id,
    date: entry.date,
    employeeName: entry.employee.fullName,
    companyId: entry.employee.companyId,
  };
}
