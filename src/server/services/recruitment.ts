import "server-only";
import { CURRENT_STAFF } from "@/lib/employee-status";
import { NATIONALITIES } from "@/lib/employment-contract";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { NotFoundError } from "@/lib/result";
import {
  clearanceDetailsSchema,
  interviewDetailsSchema,
  prrDetailsSchema,
  type ClearanceDetails,
  type ClearanceInput,
  type InterviewDetails,
  type InterviewInput,
  type JoiningLetterInput,
  type PrrDetails,
  type PrrInput,
} from "@/lib/schemas/recruitment";
import { nextPrrNo } from "./counter";

/**
 * Personnel Requirement Requests → Interview Evaluations → (Job Offers) and,
 * per employee, Joining Letters and Clearance Forms.
 *
 * A PRR and an interview belong to a company; joining letters and clearance
 * forms reach their company through the employee.
 */

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** A stored `details` column, read defensively: a bad row prints blanks. */
export function readPrrDetails(v: unknown): PrrDetails {
  return prrDetailsSchema.safeParse(v ?? {}).data ?? prrDetailsSchema.parse({});
}
export function readInterviewDetails(v: unknown): InterviewDetails {
  return interviewDetailsSchema.safeParse(v ?? {}).data ?? interviewDetailsSchema.parse({});
}
export function readClearanceDetails(v: unknown): ClearanceDetails {
  return clearanceDetailsSchema.safeParse(v ?? {}).data ?? clearanceDetailsSchema.parse({});
}

function employeeScope(ctx: ActorContext) {
  return { employee: { ...companyScopeWhere(ctx), deletedAt: null } };
}

async function employeeInScope(ctx: ActorContext, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");
  return employee;
}

const companyBrand = {
  select: {
    id: true,
    code: true,
    name: true,
    nameAr: true,
    city: true,
    addressLine: true,
    headerImageFileId: true,
  },
} as const;

// --- Personnel Requirement Requests -------------------------------------------

export async function listPrrs(ctx: ActorContext, q?: string) {
  const rows = await prisma.personnelRequest.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(q
        ? {
            OR: [
              { prrNo: { contains: q, mode: "insensitive" } },
              { jobTitle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { requestDate: "desc" },
    take: 500,
    select: {
      id: true,
      prrNo: true,
      requestDate: true,
      jobTitle: true,
      vacancies: true,
      companyId: true,
      positionId: true,
      departmentId: true,
      details: true,
      company: { select: { code: true } },
      department: { select: { name: true } },
      interviews: {
        select: {
          id: true,
          offers: { select: { convertedEmployee: { select: { id: true, employeeNo: true } } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    details: readPrrDetails(r.details),
    interviewCount: r.interviews.length,
    hired: hiredFrom(r.interviews),
  }));
}

/** Employees hired through a PRR: interview → offer → converted employee. */
function hiredFrom(
  interviews: { offers: { convertedEmployee: { id: string; employeeNo: string } | null }[] }[],
) {
  return interviews.flatMap((i) =>
    i.offers.flatMap((o) => (o.convertedEmployee ? [o.convertedEmployee] : [])),
  );
}

/** What an interview copies from a PRR. */
export async function prrOptions(ctx: ActorContext) {
  const rows = await prisma.personnelRequest.findMany({
    where: companyScopeWhere(ctx),
    orderBy: { requestDate: "desc" },
    take: 300,
    select: {
      id: true,
      prrNo: true,
      jobTitle: true,
      companyId: true,
      details: true,
      department: { select: { name: true } },
    },
  });
  return rows.map((r) => {
    const d = readPrrDetails(r.details);
    return {
      id: r.id,
      prrNo: r.prrNo,
      jobTitle: r.jobTitle,
      companyId: r.companyId,
      section: d.section,
      department: d.divisionDepartment || (r.department?.name ?? ""),
      sourcing: d.sourcing,
      externalSource: d.externalSource,
      educationRequired: d.educationRequired,
      specialization: d.specialization,
      experienceFields: d.experienceFields,
      yearsMin: d.yearsMin,
      language: d.language,
      skills: d.skills,
    };
  });
}

/**
 * Manpower inventory per position: the approved budget (A) and current
 * headcount (B) the PRR form asks HR for.
 */
export async function positionManpower(ctx: ActorContext) {
  const [positions, counts] = await Promise.all([
    prisma.position.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, budgetedHeadcount: true },
    }),
    prisma.employee.groupBy({
      by: ["positionId"],
      where: { deletedAt: null, status: "ACTIVE", ...companyScopeWhere(ctx) },
      _count: { _all: true },
    }),
  ]);
  const byPosition = new Map(counts.map((c) => [c.positionId, c._count._all]));
  return Object.fromEntries(
    positions.map((p) => [
      p.id,
      { budget: p.budgetedHeadcount, headcount: byPosition.get(p.id) ?? 0 },
    ]),
  );
}

export async function createPrr(ctx: ActorContext, input: PrrInput) {
  requireCompanyAccess(ctx, input.companyId);
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { code: true },
  });
  if (!company) throw new NotFoundError("Company not found.");
  const prrNo = input.prrNo ?? (await nextPrrNo(company.code, input.requestDate));

  return prisma.personnelRequest.create({
    data: {
      companyId: input.companyId,
      prrNo,
      requestDate: input.requestDate,
      positionId: input.positionId,
      departmentId: input.departmentId,
      jobTitle: input.jobTitle,
      vacancies: input.vacancies,
      details: json(input.details),
      createdById: ctx.userId,
    },
    select: { id: true, prrNo: true, jobTitle: true, companyId: true },
  });
}

export async function updatePrr(ctx: ActorContext, input: PrrInput & { id: string }) {
  const before = await prisma.personnelRequest.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, prrNo: true },
  });
  if (!before) throw new NotFoundError("Request not found.");
  requireCompanyAccess(ctx, input.companyId);

  return prisma.personnelRequest.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      prrNo: input.prrNo ?? before.prrNo,
      requestDate: input.requestDate,
      positionId: input.positionId,
      departmentId: input.departmentId,
      jobTitle: input.jobTitle,
      vacancies: input.vacancies,
      details: json(input.details),
    },
    select: { id: true, prrNo: true, jobTitle: true, companyId: true },
  });
}

export async function deletePrr(ctx: ActorContext, id: string) {
  const prr = await prisma.personnelRequest.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: { id: true, prrNo: true, jobTitle: true, companyId: true },
  });
  if (!prr) throw new NotFoundError("Request not found.");
  // Interviews keep their record; they just lose the link.
  await prisma.personnelRequest.delete({ where: { id } });
  return prr;
}

export async function getPrrForPrint(ctx: ActorContext, id: string) {
  const prr = await prisma.personnelRequest.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      prrNo: true,
      requestDate: true,
      jobTitle: true,
      vacancies: true,
      details: true,
      company: companyBrand,
      department: { select: { name: true } },
      interviews: {
        select: {
          offers: { select: { convertedEmployee: { select: { id: true, employeeNo: true } } } },
        },
      },
    },
  });
  if (!prr) throw new NotFoundError("Request not found.");
  return { ...prr, details: readPrrDetails(prr.details), hired: hiredFrom(prr.interviews) };
}

// --- Interview evaluations -----------------------------------------------------

export async function listInterviews(ctx: ActorContext, q?: string) {
  const rows = await prisma.interviewEvaluation.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(q
        ? {
            OR: [
              { applicantName: { contains: q, mode: "insensitive" } },
              { positionTitle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { interviewDate: "desc" },
    take: 500,
    select: {
      id: true,
      companyId: true,
      prrId: true,
      employeeId: true,
      applicantName: true,
      positionTitle: true,
      interviewDate: true,
      details: true,
      company: { select: { code: true } },
      prr: { select: { prrNo: true } },
      offers: { select: { id: true, refNo: true, status: true } },
    },
  });
  return rows.map((r) => ({ ...r, details: readInterviewDetails(r.details) }));
}

/** What a job offer copies from an interview. */
export async function interviewOptions(ctx: ActorContext) {
  const rows = await prisma.interviewEvaluation.findMany({
    where: companyScopeWhere(ctx),
    orderBy: { interviewDate: "desc" },
    take: 300,
    select: {
      id: true,
      applicantName: true,
      positionTitle: true,
      companyId: true,
      interviewDate: true,
      employeeId: true,
      prr: { select: { positionId: true } },
    },
  });
  return rows.map((r) => ({
    employeeId: r.employeeId,
    id: r.id,
    applicantName: r.applicantName,
    positionTitle: r.positionTitle,
    companyId: r.companyId,
    positionId: r.prr?.positionId ?? null,
    interviewDate: r.interviewDate.toISOString().slice(0, 10),
  }));
}

async function assertPrrInCompany(ctx: ActorContext, prrId: string | null, companyId: string) {
  if (!prrId) return;
  const prr = await prisma.personnelRequest.findFirst({
    where: { id: prrId, companyId, ...companyScopeWhere(ctx) },
    select: { id: true },
  });
  if (!prr) throw new NotFoundError("That PRR is not one of this company's.");
}

async function interviewee(ctx: ActorContext, employeeId: string | null | undefined) {
  if (!employeeId) return null;
  const e = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true },
  });
  if (!e) throw new NotFoundError("Employee not found.");
  return e.id;
}

/**
 * Employees an interview can be for, with what the form fills in from their
 * record. New hires first: they are the ones being interviewed.
 */
export async function intervieweeOptions(ctx: ActorContext) {
  const rows = await prisma.employee.findMany({
    where: { deletedAt: null, status: { in: [...CURRENT_STAFF] }, ...companyScopeWhere(ctx) },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    take: 1000,
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      status: true,
      companyId: true,
      nationality: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
      department: { select: { name: true } },
      iqama: { select: { profession: true } },
    },
  });
  return rows
    .map((e) => ({
      id: e.id,
      label: `${e.fullName} (${e.employeeNo} · ${e.company.code})${e.status === "NEW_HIRE" ? " — new hire" : ""}`,
      newHire: e.status === "NEW_HIRE",
      name: e.fullName,
      companyId: e.companyId,
      nationality: NATIONALITIES[e.nationality]?.en ?? e.nationality,
      professionInIqama: e.iqama?.profession ?? "",
      position: e.position?.title ?? "",
      department: e.department?.name ?? "",
    }))
    .sort((a, b) => Number(b.newHire) - Number(a.newHire));
}

export async function createInterview(ctx: ActorContext, input: InterviewInput) {
  requireCompanyAccess(ctx, input.companyId);
  await assertPrrInCompany(ctx, input.prrId, input.companyId);
  return prisma.interviewEvaluation.create({
    data: {
      companyId: input.companyId,
      prrId: input.prrId,
      employeeId: await interviewee(ctx, input.employeeId),
      applicantName: input.applicantName,
      positionTitle: input.positionTitle,
      interviewDate: input.interviewDate,
      details: json(input.details),
      createdById: ctx.userId,
    },
    select: { id: true, applicantName: true, companyId: true },
  });
}

export async function updateInterview(ctx: ActorContext, input: InterviewInput & { id: string }) {
  const before = await prisma.interviewEvaluation.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true },
  });
  if (!before) throw new NotFoundError("Interview not found.");
  requireCompanyAccess(ctx, input.companyId);
  await assertPrrInCompany(ctx, input.prrId, input.companyId);
  return prisma.interviewEvaluation.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      prrId: input.prrId,
      employeeId: await interviewee(ctx, input.employeeId),
      applicantName: input.applicantName,
      positionTitle: input.positionTitle,
      interviewDate: input.interviewDate,
      details: json(input.details),
    },
    select: { id: true, applicantName: true, companyId: true },
  });
}

export async function deleteInterview(ctx: ActorContext, id: string) {
  const interview = await prisma.interviewEvaluation.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: { id: true, applicantName: true, companyId: true },
  });
  if (!interview) throw new NotFoundError("Interview not found.");
  await prisma.interviewEvaluation.delete({ where: { id } });
  return interview;
}

export async function getInterviewForPrint(ctx: ActorContext, id: string) {
  const interview = await prisma.interviewEvaluation.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      applicantName: true,
      positionTitle: true,
      interviewDate: true,
      details: true,
      company: companyBrand,
      prr: { select: { prrNo: true } },
    },
  });
  if (!interview) throw new NotFoundError("Interview not found.");
  return { ...interview, details: readInterviewDetails(interview.details) };
}

// --- Joining letters -----------------------------------------------------------

/** Employees to pick from, with what a joining letter fills in. */
export async function joiningEmployeeOptions(ctx: ActorContext) {
  const rows = await prisma.employee.findMany({
    where: { deletedAt: null, status: { in: [...CURRENT_STAFF] }, ...companyScopeWhere(ctx) },
    orderBy: { fullName: "asc" },
    take: 1000,
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      joiningDate: true,
      position: { select: { title: true } },
      company: { select: { code: true, city: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    employeeNo: e.employeeNo,
    joiningDate: e.joiningDate.toISOString().slice(0, 10),
    positionTitle: e.position?.title ?? "",
    section: [e.company.code, e.company.city?.toUpperCase()].filter(Boolean).join("-"),
  }));
}

export async function listJoiningLetters(
  ctx: ActorContext,
  filters: { employeeId?: string | undefined; q?: string | undefined } = {},
) {
  return prisma.joiningLetter.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.q
        ? {
            employee: {
              ...companyScopeWhere(ctx),
              deletedAt: null,
              OR: [
                { fullName: { contains: filters.q, mode: "insensitive" } },
                { employeeNo: { contains: filters.q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: { letterDate: "desc" },
    take: 500,
    select: {
      id: true,
      employeeId: true,
      letterDate: true,
      joiningDate: true,
      positionTitle: true,
      section: true,
      remarks: true,
      employee: {
        select: { fullName: true, employeeNo: true, company: { select: { code: true } } },
      },
    },
  });
}

export async function createJoiningLetter(ctx: ActorContext, input: JoiningLetterInput) {
  const employee = await employeeInScope(ctx, input.employeeId);
  const current = await prisma.employee.findUniqueOrThrow({
    where: { id: input.employeeId },
    select: { status: true },
  });
  // Joining is when a new hire becomes staff: Active, from the joining date.
  const activate = current.status === "NEW_HIRE";
  const letter = await prisma.$transaction(async (tx) => {
    const created = await tx.joiningLetter.create({
      data: { ...input, createdById: ctx.userId },
      select: { id: true },
    });
    if (activate) {
      await tx.employee.update({
        where: { id: input.employeeId },
        data: { status: "ACTIVE", joiningDate: input.joiningDate },
      });
    }
    return created;
  });
  return {
    ...letter,
    activated: activate,
    employeeName: employee.fullName,
    companyId: employee.companyId,
  };
}

export async function updateJoiningLetter(
  ctx: ActorContext,
  input: JoiningLetterInput & { id: string },
) {
  const before = await prisma.joiningLetter.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: { id: true },
  });
  if (!before) throw new NotFoundError("Joining letter not found.");
  const employee = await employeeInScope(ctx, input.employeeId);
  const { id, ...data } = input;
  await prisma.joiningLetter.update({ where: { id }, data });
  return { id, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function deleteJoiningLetter(ctx: ActorContext, id: string) {
  const letter = await prisma.joiningLetter.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: { id: true, employee: { select: { fullName: true, companyId: true } } },
  });
  if (!letter) throw new NotFoundError("Joining letter not found.");
  await prisma.joiningLetter.delete({ where: { id } });
  return { id, employeeName: letter.employee.fullName, companyId: letter.employee.companyId };
}

export async function getJoiningLetterForPrint(ctx: ActorContext, id: string) {
  const letter = await prisma.joiningLetter.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      letterDate: true,
      joiningDate: true,
      positionTitle: true,
      section: true,
      remarks: true,
      employee: { select: { fullName: true, employeeNo: true, company: companyBrand } },
    },
  });
  if (!letter) throw new NotFoundError("Joining letter not found.");
  return letter;
}

// --- Clearance forms -------------------------------------------------------------

const ASSET_LABEL: Record<string, string> = {
  LAPTOP: "Laptop",
  DESKTOP: "Desktop",
  MONITOR: "Monitor",
  PRINTER: "Printer",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  IP_PHONE: "IP phone",
  NETWORK: "Network device",
  SERVER: "Server",
  PERIPHERAL: "Peripheral",
  OTHER: "Device",
};

/**
 * A clearance form as the system knows the employee today: company and
 * department, who manages them, and what they still hold — IT equipment, a
 * phone, a vehicle, a bed. Anything not held reads N/A. All of it is a
 * suggestion the form can change.
 */
export async function clearanceDefaults(ctx: ActorContext, employeeId: string) {
  const e = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      workEmail: true,
      lastWorkingDate: true,
      company: { select: { name: true, city: true } },
      department: {
        select: { name: true, headEmployee: { select: { fullName: true } } },
      },
      position: { select: { title: true } },
      manager: { select: { fullName: true } },
      userAccount: { select: { email: true } },
      assetAssignments: {
        where: { returnedAt: null },
        select: { asset: { select: { type: true, brand: true, model: true, assetCode: true } } },
      },
      vehicleAssignments: {
        where: { unassignedAt: null },
        select: { vehicle: { select: { plateNumber: true, make: true, model: true } } },
      },
      bedAssignments: {
        where: { checkOutDate: null },
        select: {
          bed: {
            select: {
              bedLabel: true,
              room: { select: { roomNumber: true, accommodation: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!e) throw new NotFoundError("Employee not found.");

  const NA = "N/A";
  const list = (items: string[]) => (items.length ? items.join(", ") : NA);
  const assets = e.assetAssignments.map((a) => a.asset);
  const describe = (a: (typeof assets)[number]) =>
    `${ASSET_LABEL[a.type] ?? a.type} ${a.brand} ${a.model} (${a.assetCode})`;
  const phones = assets.filter((a) => a.type === "MOBILE");
  const devices = assets.filter((a) => a.type !== "MOBILE");
  const deptManager = e.department?.headEmployee?.fullName ?? "";
  const line = (value: string, name = "") => ({ value, name });

  const details: ClearanceDetails = {
    companyName: e.company.name,
    location: e.company.city ?? "",
    department: e.department?.name ?? "",
    position: e.position?.title ?? "",
    departmentManager: deptManager,
    lines: {
      serverUser: line(NA),
      email: line(e.workEmail ?? NA),
      erp: line(e.userAccount?.email ?? NA),
      hardware: line(list(devices.map(describe))),
      software: line(NA),
      accessCards: line(NA),
      warehouse: line(NA),
      supervisor: line("", e.manager?.fullName ?? ""),
      idCard: line(NA),
      cars: line(
        list(
          e.vehicleAssignments.map(
            (v) => `${v.vehicle.make} ${v.vehicle.model} (${v.vehicle.plateNumber})`,
          ),
        ),
      ),
      sim: line(list(phones.map(describe))),
      accommodation: line(
        list(
          e.bedAssignments.map(
            (b) =>
              `${b.bed.room.accommodation.name}, room ${b.bed.room.roomNumber}, bed ${b.bed.bedLabel}`,
          ),
        ),
      ),
      finance: line(""),
    },
    signers: { direct: deptManager },
  };

  return {
    endDate: e.lastWorkingDate ? e.lastWorkingDate.toISOString().slice(0, 10) : "",
    details,
  };
}

export async function listClearanceForms(
  ctx: ActorContext,
  filters: { employeeId?: string | undefined; q?: string | undefined } = {},
) {
  const rows = await prisma.clearanceForm.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.q
        ? {
            employee: {
              ...companyScopeWhere(ctx),
              deletedAt: null,
              OR: [
                { fullName: { contains: filters.q, mode: "insensitive" } },
                { employeeNo: { contains: filters.q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: { formDate: "desc" },
    take: 500,
    select: {
      id: true,
      employeeId: true,
      formDate: true,
      endDate: true,
      details: true,
      employee: {
        select: { fullName: true, employeeNo: true, company: { select: { code: true } } },
      },
    },
  });
  return rows.map((r) => ({ ...r, details: readClearanceDetails(r.details) }));
}

export async function createClearanceForm(ctx: ActorContext, input: ClearanceInput) {
  const employee = await employeeInScope(ctx, input.employeeId);
  const form = await prisma.clearanceForm.create({
    data: {
      employeeId: input.employeeId,
      formDate: input.formDate,
      endDate: input.endDate,
      details: json(input.details),
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  return { ...form, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function updateClearanceForm(
  ctx: ActorContext,
  input: ClearanceInput & { id: string },
) {
  const before = await prisma.clearanceForm.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: { id: true },
  });
  if (!before) throw new NotFoundError("Clearance form not found.");
  const employee = await employeeInScope(ctx, input.employeeId);
  await prisma.clearanceForm.update({
    where: { id: input.id },
    data: {
      employeeId: input.employeeId,
      formDate: input.formDate,
      endDate: input.endDate,
      details: json(input.details),
    },
  });
  return { id: input.id, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function deleteClearanceForm(ctx: ActorContext, id: string) {
  const form = await prisma.clearanceForm.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: { id: true, employee: { select: { fullName: true, companyId: true } } },
  });
  if (!form) throw new NotFoundError("Clearance form not found.");
  await prisma.clearanceForm.delete({ where: { id } });
  return { id, employeeName: form.employee.fullName, companyId: form.employee.companyId };
}

export async function getClearanceForPrint(ctx: ActorContext, id: string) {
  const form = await prisma.clearanceForm.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      formDate: true,
      endDate: true,
      details: true,
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          familyName: true,
          fullName: true,
          employeeNo: true,
          joiningDate: true,
          iqama: { select: { iqamaNumber: true } },
          company: companyBrand,
        },
      },
    },
  });
  if (!form) throw new NotFoundError("Clearance form not found.");
  return { ...form, details: readClearanceDetails(form.details) };
}
