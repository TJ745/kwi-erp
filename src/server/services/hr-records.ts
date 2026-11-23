import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { NotFoundError } from "@/lib/result";
import { suggestedNextLevel, type WarningLevel } from "@/lib/hr-calc";
import type { WarningInput } from "@/lib/schemas/hr-records";

/**
 * Warnings, increments, and evaluations — brief §19–§22.
 *
 * All three hang off an employee, so they are scoped through the employee's
 * company rather than carrying their own scope column.
 */

/** Employee-owned records reach their company through the relation. */
function employeeScope(ctx: ActorContext) {
  return { employee: { ...companyScopeWhere(ctx), deletedAt: null } };
}

async function assertEmployeeInScope(ctx: ActorContext, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, employeeNo: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");
  return employee;
}

// --- Warning letters ---------------------------------------------------------

export async function listWarnings(
  ctx: ActorContext,
  filters: { employeeId?: string | undefined; level?: string | undefined } = {},
) {
  return prisma.warningLetter.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.level ? { level: filters.level as WarningLevel } : {}),
    },
    orderBy: { issuedDate: "desc" },
    take: 500,
    select: {
      id: true,
      level: true,
      reason: true,
      description: true,
      descriptionAr: true,
      project: true,
      issuedDate: true,
      issuedById: true,
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
}

/** Prior warnings for one employee, and what would normally come next. */
export async function warningHistory(ctx: ActorContext, employeeId: string) {
  await assertEmployeeInScope(ctx, employeeId);

  const previous = await prisma.warningLetter.findMany({
    where: { employeeId },
    orderBy: { issuedDate: "asc" },
    select: { id: true, level: true, issuedDate: true, reason: true },
  });

  return {
    previous,
    suggested: suggestedNextLevel(previous.map((p) => p.level)),
  };
}

export async function createWarning(ctx: ActorContext, input: WarningInput) {
  const employee = await assertEmployeeInScope(ctx, input.employeeId);

  const warning = await prisma.warningLetter.create({
    data: {
      employeeId: input.employeeId,
      level: input.level,
      reason: input.reason,
      description: input.description,
      descriptionAr: input.descriptionAr,
      project: input.project ?? null,
      issuedDate: input.issuedDate,
      issuedById: ctx.userId,
    },
    select: { id: true, level: true, reason: true, issuedDate: true },
  });

  return { ...warning, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function updateWarning(ctx: ActorContext, input: WarningInput & { id: string }) {
  const before = await prisma.warningLetter.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      level: true,
      reason: true,
      issuedDate: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!before) throw new NotFoundError("Warning not found.");

  const after = await prisma.warningLetter.update({
    where: { id: input.id },
    data: {
      level: input.level,
      reason: input.reason,
      description: input.description,
      descriptionAr: input.descriptionAr,
      project: input.project ?? null,
      issuedDate: input.issuedDate,
    },
    select: { id: true, level: true, reason: true, issuedDate: true },
  });

  return {
    before: { level: before.level, reason: before.reason, issuedDate: before.issuedDate },
    after,
    employeeName: before.employee.fullName,
    companyId: before.employee.companyId,
  };
}

export async function deleteWarning(ctx: ActorContext, id: string) {
  const warning = await prisma.warningLetter.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      level: true,
      reason: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!warning) throw new NotFoundError("Warning not found.");

  await prisma.warningLetter.delete({ where: { id } });
  return {
    ...warning,
    employeeName: warning.employee.fullName,
    companyId: warning.employee.companyId,
  };
}

/** Everything the printed bilingual letter needs. */
export async function getWarningForPrint(ctx: ActorContext, id: string) {
  const warning = await prisma.warningLetter.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      level: true,
      reason: true,
      description: true,
      descriptionAr: true,
      project: true,
      issuedDate: true,
      employee: {
        select: {
          id: true,
          employeeNo: true,
          fullName: true,
          fullNameAr: true,
          gender: true,
          position: { select: { title: true, titleAr: true } },
          company: {
            select: {
              id: true,
              name: true,
              nameAr: true,
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
      },
    },
  });
  if (!warning) throw new NotFoundError("Warning not found.");
  return warning;
}

export async function employeeOptions(ctx: ActorContext) {
  return prisma.employee.findMany({
    where: { deletedAt: null, ...companyScopeWhere(ctx) },
    orderBy: { fullName: "asc" },
    take: 1000,
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      companyId: true,
      status: true,
      company: { select: { code: true } },
    },
  });
}

// --- Everything else on an employee's profile ----------------------------------

/** The job offer(s) an employee was hired on. */
export async function offersForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.jobOffer.findMany({
    where: { convertedEmployeeId: employeeId, ...companyScopeWhere(ctx) },
    orderBy: { createdAt: "desc" },
    select: { id: true, refNo: true, offerDate: true, status: true, createdAt: true },
  });
}

/** Letters & Memos generated for an employee. */
export async function lettersForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.generatedLetter.findMany({
    where: { employeeId, ...companyScopeWhere(ctx) },
    orderBy: { generatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      letterNo: true,
      status: true,
      generatedAt: true,
      template: { select: { name: true } },
    },
  });
}

/** Vehicles an employee has driven, and the handovers they took part in. */
export async function vehiclesForEmployee(ctx: ActorContext, employeeId: string) {
  const vehicle = { select: { id: true, plateNumber: true, make: true, model: true } } as const;
  const [assignments, handovers] = await Promise.all([
    prisma.vehicleAssignment.findMany({
      where: { employeeId, vehicle: companyScopeWhere(ctx) },
      orderBy: { assignedAt: "desc" },
      take: 50,
      select: { id: true, assignedAt: true, unassignedAt: true, vehicle },
    }),
    prisma.vehicleHandover.findMany({
      where: {
        OR: [{ fromEmployeeId: employeeId }, { toEmployeeId: employeeId }],
        vehicle: companyScopeWhere(ctx),
      },
      orderBy: { handoverDate: "desc" },
      take: 50,
      select: {
        id: true,
        handoverDate: true,
        fromEmployeeId: true,
        vehicle,
        fromEmployee: { select: { fullName: true } },
        toEmployee: { select: { fullName: true } },
      },
    }),
  ]);
  return { assignments, handovers };
}
