import "server-only";
import type { LeaveStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import type { LeaveRequestInput } from "@/lib/schemas/hr";
import { contractParticularsSchema } from "@/lib/schemas/hr";
import { dmy, readLeaveForm, type LeaveForm } from "@/lib/leave-form";
import { BLOCKING_LEAVE_STATUSES, canTransition, countLeaveDays } from "@/lib/leave-rules";

/**
 * Leave requests.
 *
 * Brief §50: "a rejected leave cannot appear as approved." Status lives in a
 * single column on a single row and every change goes through the state machine
 * below, so there is no path by which two views could disagree.
 */

const SORTABLE = ["startDate", "createdAt", "status"] as const;

export type LeaveListRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  days: string;
  status: LeaveStatus;
  reason: string | null;
  decidedAt: Date | null;
  companyCode: string;
  leaveTypeId: string;
  handoverToId: string | null;
  form: LeaveForm;
};

/**
 * Visibility: without hr.leave.view an actor sees only their own requests.
 * Managers and HR see everything in company scope.
 */
function visibilityWhere(ctx: ActorContext): Prisma.LeaveRequestWhereInput {
  if (ctx.permissions.has("hr.leave.view")) return {};
  // A user with no linked employee record has no own-leave to see.
  return { employeeId: ctx.employeeId ?? "__none__" };
}

export async function listLeaveRequests(
  ctx: ActorContext,
  query: ListQuery,
  filters: { status?: string | undefined; employeeId?: string | undefined } = {},
): Promise<Paginated<LeaveListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "startDate", direction: "desc" });

  const where: Prisma.LeaveRequestWhereInput = {
    employee: companyScopeWhere(ctx),
    ...visibilityWhere(ctx),
    ...(filters.status ? { status: filters.status as LeaveStatus } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(query.q ? { employee: { fullName: { contains: query.q, mode: "insensitive" } } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        days: true,
        status: true,
        reason: true,
        decidedAt: true,
        leaveTypeId: true,
        handoverToId: true,
        form: true,
        leaveType: { select: { name: true } },
        employee: {
          select: { fullName: true, employeeNo: true, company: { select: { code: true } } },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return paginate(
    rows.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employee.fullName,
      employeeNo: l.employee.employeeNo,
      leaveTypeName: l.leaveType.name,
      startDate: l.startDate,
      endDate: l.endDate,
      days: l.days.toString(),
      status: l.status,
      reason: l.reason,
      decidedAt: l.decidedAt,
      companyCode: l.employee.company.code,
      leaveTypeId: l.leaveTypeId,
      handoverToId: l.handoverToId,
      form: readLeaveForm(l.form),
    })),
    total,
    query,
  );
}

export async function createLeaveRequest(ctx: ActorContext, input: LeaveRequestInput) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, status: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  // Requesting for someone else needs the manage permission; everyone can
  // request their own.
  const isOwn = ctx.employeeId === input.employeeId;
  if (!isOwn && !ctx.permissions.has("hr.leave.view")) {
    throw new ForbiddenError("You can only request leave for yourself.");
  }

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: input.leaveTypeId },
    select: { id: true, name: true },
  });
  if (!leaveType) throw new NotFoundError("Leave type not found.");

  // Overlapping leave in a non-terminal state is almost always a duplicate
  // submission, and approving both would double-count the absence.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: BLOCKING_LEAVE_STATUSES },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlap) {
    throw new ConflictError(
      `This overlaps an existing request (${overlap.startDate.toISOString().slice(0, 10)} to ${overlap.endDate.toISOString().slice(0, 10)}).`,
    );
  }

  const days = countLeaveDays(input.startDate, input.endDate);

  // Leave is recorded by HR once it is agreed, so it is approved as it is
  // entered — there is no one else to approve it.
  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason ?? null,
      handoverToId: input.handoverToId ?? null,
      form: (input.form ?? {}) as Prisma.InputJsonValue,
      status: "APPROVED",
      decidedAt: new Date(),
      createdById: ctx.userId,
    },
    select: { id: true, days: true },
  });

  return {
    ...created,
    employeeName: employee.fullName,
    companyId: employee.companyId,
    leaveTypeName: leaveType.name,
  };
}

export async function updateLeaveRequest(
  ctx: ActorContext,
  input: LeaveRequestInput & { id: string },
) {
  const before = await prisma.leaveRequest.findFirst({
    where: { id: input.id, employee: companyScopeWhere(ctx) },
    select: { id: true, employeeId: true },
  });
  if (!before) throw new NotFoundError("Leave request not found.");

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      id: { not: input.id },
      employeeId: input.employeeId,
      status: { in: BLOCKING_LEAVE_STATUSES },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
    },
    select: { startDate: true, endDate: true },
  });
  if (overlap) {
    throw new ConflictError(
      `This overlaps another leave (${overlap.startDate.toISOString().slice(0, 10)} to ${overlap.endDate.toISOString().slice(0, 10)}).`,
    );
  }

  await prisma.leaveRequest.update({
    where: { id: input.id },
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      days: countLeaveDays(input.startDate, input.endDate),
      reason: input.reason ?? null,
      handoverToId: input.handoverToId ?? null,
      form: (input.form ?? {}) as Prisma.InputJsonValue,
    },
  });
  return { id: input.id, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function deleteLeaveRequest(ctx: ActorContext, id: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id, employee: companyScopeWhere(ctx) },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!request) throw new NotFoundError("Leave request not found.");
  await prisma.leaveRequest.delete({ where: { id } });
  return {
    id,
    employeeName: request.employee.fullName,
    companyId: request.employee.companyId,
    dates: `${request.startDate.toISOString().slice(0, 10)} to ${request.endDate.toISOString().slice(0, 10)}`,
  };
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

/**
 * What a new leave form starts from, out of the employee's record: contact
 * details from their contract and emergency contacts, entitlement from their
 * offer or contract, the tickets on their contract, and when they came back
 * from their last leave. Every value is a suggestion the form can change.
 */
export async function leaveDefaults(ctx: ActorContext, employeeId: string): Promise<LeaveForm> {
  const e = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      nationality: true,
      mobile: true,
      personalEmail: true,
      workEmail: true,
      emergencyContacts: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { phone: true, relation: true },
      },
      contracts: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: { termYears: true, particulars: true },
      },
      jobOfferOrigin: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { leavePlan: true, candidateAddress: true, ticketDestination: true },
      },
      leaveRequests: {
        where: { status: "APPROVED" },
        orderBy: { endDate: "desc" },
        take: 1,
        select: { endDate: true },
      },
    },
  });
  if (!e) throw new NotFoundError("Employee not found.");

  const contract = e.contracts[0];
  const p = contract
    ? contractParticularsSchema.safeParse(contract.particulars ?? {}).data
    : undefined;
  const offer = e.jobOfferOrigin[0];
  const relative = e.emergencyContacts[0];
  const lastLeave = e.leaveRequests[0];
  const twoYears = offer?.leavePlan === "42_AFTER_2Y" || contract?.termYears === 2;
  const returned = lastLeave ? new Date(lastLeave.endDate.getTime() + 24 * 60 * 60 * 1000) : null;

  return readLeaveForm({
    country: countryName(e.nationality),
    destination: p?.ticketDestinationEn || offer?.ticketDestination || "",
    homeAddress: p?.homeAddressEn || offer?.candidateAddress || "",
    cityCountry: "",
    telHome: p?.homePhone || e.mobile || "",
    telRelative: relative ? `${relative.phone} (${relative.relation})` : "",
    email: e.personalEmail || e.workEmail || "",
    leaveDueEvery: contract || offer ? (twoYears ? "2 years" : "1 year") : "",
    lastArrival: dmy(returned),
    ticketsSelf: contract ? "1" : "",
    ticketsWife: p?.ticketWife ? "1" : "",
    ticketsChildren: p && p.ticketChildren > 0 ? String(p.ticketChildren) : "",
  });
}

/** Everything the printed Leave Request needs. */
export async function getLeaveForPrint(ctx: ActorContext, id: string) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id, employee: companyScopeWhere(ctx) },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      days: true,
      createdAt: true,
      form: true,
      leaveType: { select: { key: true, name: true } },
      handoverTo: { select: { fullName: true } },
      employee: {
        select: {
          fullName: true,
          employeeNo: true,
          joiningDate: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
          company: {
            select: {
              id: true,
              name: true,
              headerImageFileId: true,
              footerImageFileId: true,
            },
          },
        },
      },
    },
  });
  if (!leave) throw new NotFoundError("Leave request not found.");
  return { ...leave, form: readLeaveForm(leave.form) };
}

export async function decideLeaveRequest(
  ctx: ActorContext,
  input: { id: string; decision: "APPROVED" | "REJECTED"; comment?: string | undefined },
) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: input.id, employee: companyScopeWhere(ctx) },
    select: {
      id: true,
      status: true,
      employeeId: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!request) throw new NotFoundError("Leave request not found.");

  // Approving your own leave defeats the point of an approval step.
  if (ctx.employeeId && ctx.employeeId === request.employeeId) {
    throw new ForbiddenError("You cannot decide your own leave request.");
  }

  if (!canTransition(request.status, input.decision)) {
    throw new ConflictError(
      `A ${request.status.toLowerCase()} request cannot be ${input.decision.toLowerCase()}.`,
    );
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: input.id },
    data: {
      status: input.decision,
      approverId: ctx.employeeId,
      decidedAt: new Date(),
      decisionComment: input.comment ?? null,
    },
    select: { id: true, status: true },
  });

  return {
    before: { status: request.status },
    after: { status: updated.status },
    employeeName: request.employee.fullName,
    companyId: request.employee.companyId,
  };
}

export async function cancelLeaveRequest(ctx: ActorContext, id: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id, employee: companyScopeWhere(ctx) },
    select: {
      id: true,
      status: true,
      employeeId: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!request) throw new NotFoundError("Leave request not found.");

  const isOwn = ctx.employeeId === request.employeeId;
  if (!isOwn && !ctx.permissions.has("hr.leave.approve")) {
    throw new ForbiddenError("You cannot cancel someone else's leave request.");
  }

  if (!canTransition(request.status, "CANCELLED")) {
    throw new ConflictError(`A ${request.status.toLowerCase()} request cannot be cancelled.`);
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });

  return {
    before: { status: request.status },
    after: { status: "CANCELLED" as const },
    employeeName: request.employee.fullName,
    companyId: request.employee.companyId,
  };
}

export async function leaveTypes() {
  return prisma.leaveType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isPaid: true, maxDaysPerYear: true },
  });
}

export type LeaveCounts = { onLeaveNow: number; upcoming: number };

export async function leaveCounts(ctx: ActorContext): Promise<LeaveCounts> {
  const scope = { employee: companyScopeWhere(ctx), ...visibilityWhere(ctx) };
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [onLeaveNow, upcoming] = await Promise.all([
    prisma.leaveRequest.count({
      where: { ...scope, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    }),
    prisma.leaveRequest.count({
      where: { ...scope, status: "APPROVED", startDate: { gt: today } },
    }),
  ]);

  return { onLeaveNow, upcoming };
}

/** Leave for one employee — powers the profile tab. */
export async function leaveForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.leaveRequest.findMany({
    where: { employeeId, employee: companyScopeWhere(ctx) },
    orderBy: { startDate: "desc" },
    take: 50,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      days: true,
      status: true,
      reason: true,
      leaveType: { select: { name: true } },
    },
  });
}
