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
import {
  BLOCKING_LEAVE_STATUSES,
  canTransition,
  countLeaveDays,
} from "@/lib/leave-rules";

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
    ...(query.q
      ? { employee: { fullName: { contains: query.q, mode: "insensitive" } } }
      : {}),
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

  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason ?? null,
      handoverToId: input.handoverToId ?? null,
      status: "PENDING",
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

export type LeaveCounts = { pending: number; approvedUpcoming: number };

export async function leaveCounts(ctx: ActorContext): Promise<LeaveCounts> {
  const scope = { employee: companyScopeWhere(ctx), ...visibilityWhere(ctx) };

  const [pending, approvedUpcoming] = await Promise.all([
    prisma.leaveRequest.count({ where: { ...scope, status: "PENDING" } }),
    prisma.leaveRequest.count({
      where: { ...scope, status: "APPROVED", startDate: { gte: new Date() } },
    }),
  ]);

  return { pending, approvedUpcoming };
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
