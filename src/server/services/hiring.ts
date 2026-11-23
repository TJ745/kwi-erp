import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { offerTotal } from "@/lib/job-offer";
import { nextOfferRef } from "./counter";
import type { ActorContext } from "@/server/auth/context";
import {
  companyScopeWhere,
  optionalCompanyScopeWhere,
  requireCompanyAccess,
} from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import type { JobDescriptionInput, JobOfferInput } from "@/lib/schemas/hiring";
import { assertEmployeeNoFree } from "./employees";

/**
 * Hiring — job descriptions and offers, brief §17, §18.
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
      ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ isActive: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      department: true,
      reportsTo: true,
      oversees: true,
      organizational: true,
      departmental: true,
      education: true,
      experience: true,
      skills: true,
      others: true,
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

export async function createJobDescription(ctx: ActorContext, input: JobDescriptionInput) {
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);

  return prisma.jobDescription.create({
    data: {
      companyId: input.companyId ?? null,
      positionId: input.positionId ?? null,
      title: input.title,
      department: input.department ?? null,
      reportsTo: input.reportsTo ?? null,
      oversees: input.oversees ?? null,
      organizational: input.organizational ?? null,
      departmental: input.departmental ?? null,
      education: input.education ?? null,
      experience: input.experience ?? null,
      skills: input.skills ?? null,
      others: input.others ?? null,
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
      department: input.department ?? null,
      reportsTo: input.reportsTo ?? null,
      oversees: input.oversees ?? null,
      organizational: input.organizational ?? null,
      departmental: input.departmental ?? null,
      education: input.education ?? null,
      experience: input.experience ?? null,
      skills: input.skills ?? null,
      others: input.others ?? null,
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

/** One description for printing. */
export async function getJobDescription(ctx: ActorContext, id: string) {
  const jd = await prisma.jobDescription.findFirst({
    where: { id, ...optionalCompanyScopeWhere(ctx) },
    select: {
      id: true,
      title: true,
      department: true,
      reportsTo: true,
      oversees: true,
      organizational: true,
      departmental: true,
      education: true,
      experience: true,
      skills: true,
      others: true,
      version: true,
    },
  });
  if (!jd) throw new NotFoundError("Job description not found.");
  return jd;
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
      interviewId: true,
      salutation: true,
      candidateIdType: true,
      candidateIdNumber: true,
      candidateAddress: true,
      offerDate: true,
      refNo: true,
      basicSalary: true,
      housingAllowance: true,
      transportAllowance: true,
      mobileAllowance: true,
      contractYears: true,
      probationDays: true,
      familyStatus: true,
      leavePlan: true,
      ticketCover: true,
      ticketDestination: true,
      medicalCover: true,
      companyId: true,
      positionId: true,
      jobDescriptionId: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
      convertedEmployee: { select: { id: true, employeeNo: true, fullName: true } },
    },
  });
}

/**
 * The letter's fields; the total is the sum of the parts when they are given.
 * Someone without employees.salary.view never sees the amounts, so their save
 * must not overwrite them with blanks: `keepSalary` leaves them as stored.
 */
function offerLetterData(input: JobOfferInput, keepSalary = false) {
  const parts = {
    basicSalary: input.basicSalary ?? null,
    housingAllowance: input.housingAllowance ?? null,
    transportAllowance: input.transportAllowance ?? null,
    mobileAllowance: input.mobileAllowance ?? null,
  };
  return {
    salutation: input.salutation,
    candidateIdType: input.candidateIdType ?? null,
    candidateIdNumber: input.candidateIdNumber ?? null,
    candidateAddress: input.candidateAddress ?? null,
    offerDate: input.offerDate ?? null,
    ...(keepSalary
      ? {}
      : { ...parts, proposedSalary: offerTotal(parts) ?? input.proposedSalary ?? null }),
    contractYears: input.contractYears,
    probationDays: input.probationDays,
    familyStatus: input.familyStatus,
    leavePlan: input.leavePlan,
    ticketCover: input.ticketCover,
    ticketDestination: input.ticketDestination ?? null,
    medicalCover: input.medicalCover,
  };
}

/** An offer can only be made from an interview held for the same company. */
async function assertInterviewInCompany(
  ctx: ActorContext,
  interviewId: string | undefined,
  companyId: string,
) {
  if (!interviewId) return;
  const interview = await prisma.interviewEvaluation.findFirst({
    where: { id: interviewId, companyId, ...companyScopeWhere(ctx) },
    select: { id: true },
  });
  if (!interview) throw new NotFoundError("That interview is not one of this company's.");
}

export async function createJobOffer(ctx: ActorContext, input: JobOfferInput) {
  requireCompanyAccess(ctx, input.companyId);
  await assertInterviewInCompany(ctx, input.interviewId, input.companyId);
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { code: true },
  });
  if (!company) throw new NotFoundError("Company not found.");
  // "Our Ref." is numbered per company and year unless one is typed in.
  const refNo = input.refNo ?? (await nextOfferRef(company.code, input.offerDate ?? new Date()));

  return prisma.jobOffer.create({
    data: {
      refNo,
      companyId: input.companyId,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail ?? null,
      candidatePhone: input.candidatePhone ?? null,
      positionId: input.positionId ?? null,
      jobDescriptionId: input.jobDescriptionId ?? null,
      ...offerLetterData(input),
      currency: input.currency,
      proposedJoiningDate: input.proposedJoiningDate ?? null,
      status: input.status as "DRAFT",
      sentAt: input.sentAt ?? null,
      notes: input.notes ?? null,
      interviewId: input.interviewId ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, candidateName: true, status: true, companyId: true },
  });
}

export async function updateJobOffer(ctx: ActorContext, input: JobOfferInput & { id: string }) {
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
  await assertInterviewInCompany(ctx, input.interviewId, input.companyId);

  // Once an offer produced an employee, its terms are what that person was
  // hired on. Editing them afterwards rewrites history.
  if (before.convertedEmployeeId) {
    throw new ConflictError(
      "This offer has been converted into an employee and can no longer be edited.",
    );
  }

  const decided =
    input.status === "ACCEPTED" || input.status === "DECLINED" || input.status === "WITHDRAWN";

  const after = await prisma.jobOffer.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail ?? null,
      candidatePhone: input.candidatePhone ?? null,
      positionId: input.positionId ?? null,
      jobDescriptionId: input.jobDescriptionId ?? null,
      ...offerLetterData(input, !ctx.permissions.has("employees.salary.view")),
      ...(input.refNo ? { refNo: input.refNo } : {}),
      currency: input.currency,
      proposedJoiningDate: input.proposedJoiningDate ?? null,
      status: input.status as "DRAFT",
      sentAt: input.sentAt ?? null,
      notes: input.notes ?? null,
      interviewId: input.interviewId ?? null,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        "An employee with those details already exists. Check the directory before converting.",
      );
    }
    throw error;
  }
}

/** One offer, with everything the printed letter needs. */
export async function getJobOfferForPrint(ctx: ActorContext, id: string) {
  const offer = await prisma.jobOffer.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    include: {
      position: { select: { title: true } },
      company: {
        select: {
          id: true,
          code: true,
          name: true,
          addressLine: true,
          city: true,
          crNumber: true,
          vatNumber: true,
          phone: true,
          email: true,
          website: true,
          headerImageFileId: true,
          footerImageFileId: true,
        },
      },
    },
  });
  if (!offer) throw new NotFoundError("Offer not found.");
  return offer;
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
    throw new ConflictError("This offer produced an employee record and cannot be deleted.");
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
