import "server-only";
import type { EntityType, Prisma, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ForbiddenError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import type { TaskInput } from "@/lib/schemas/task";
import { nextTaskNo } from "./counter";
import { resolveUserNames } from "./users";

/**
 * Tasks & follow-ups (brief §32).
 *
 * "Overdue" is COMPUTED, never stored: dueDate < today AND status not in
 * (COMPLETED, CANCELLED). Storing it would be wrong by morning.
 */

const SORTABLE = ["dueDate", "priority", "status", "createdAt", "title"] as const;

/** Statuses that mean the task is finished and can never be overdue. */
export const CLOSED_STATUSES: TaskStatus[] = ["COMPLETED", "CANCELLED"];

export type TaskListRow = {
  id: string;
  taskNo: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: Date | null;
  followUpDate: Date | null;
  assignedToId: string | null;
  assignedToName: string | null;
  companyCode: string;
  entityType: EntityType | null;
  entityId: string | null;
  commentCount: number;
  isOverdue: boolean;
};

export type TaskFilters = {
  status?: string | undefined;
  priority?: string | undefined;
  assignee?: string | undefined;
  overdue?: boolean | undefined;
};

/**
 * Visibility: `tasks.viewAll` sees every task in scope; otherwise an actor sees
 * only tasks they were assigned or created (docs/MODULES.md §4).
 */
function visibilityWhere(ctx: ActorContext): Prisma.TaskWhereInput {
  if (ctx.permissions.has("tasks.viewAll")) return {};
  return { OR: [{ assignedToId: ctx.userId }, { createdById: ctx.userId }] };
}

export async function listTasks(
  ctx: ActorContext,
  query: ListQuery,
  filters: TaskFilters = {},
): Promise<Paginated<TaskListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "dueDate", direction: "asc" });
  const now = new Date();

  const where: Prisma.TaskWhereInput = {
    ...companyScopeWhere(ctx),
    ...visibilityWhere(ctx),
    ...(filters.status ? { status: filters.status as TaskStatus } : {}),
    ...(filters.priority ? { priority: filters.priority as "LOW" } : {}),
    ...(filters.assignee === "me" ? { assignedToId: ctx.userId } : {}),
    ...(filters.overdue
      ? { dueDate: { lt: now }, status: { notIn: CLOSED_STATUSES } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { taskNo: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      // Nulls last so undated tasks do not crowd out the ones with deadlines.
      orderBy:
        sort.field === "dueDate"
          ? { dueDate: { sort: sort.direction, nulls: "last" } }
          : { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        taskNo: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        followUpDate: true,
        assignedToId: true,
        entityType: true,
        entityId: true,
        company: { select: { code: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  const names = await resolveUserNames(rows.map((r) => r.assignedToId));

  return paginate(
    rows.map((t) => ({
      id: t.id,
      taskNo: t.taskNo,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      followUpDate: t.followUpDate,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedToId ? (names.get(t.assignedToId) ?? null) : null,
      companyCode: t.company.code,
      entityType: t.entityType,
      entityId: t.entityId,
      commentCount: t._count.comments,
      isOverdue: isOverdue(t.dueDate, t.status, now),
    })),
    total,
    query,
  );
}

export function isOverdue(
  dueDate: Date | null,
  status: TaskStatus,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  if (CLOSED_STATUSES.includes(status)) return false;
  return dueDate.getTime() < now.getTime();
}


export async function getTask(ctx: ActorContext, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, ...companyScopeWhere(ctx), ...visibilityWhere(ctx) },
    select: {
      id: true,
      taskNo: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      followUpDate: true,
      completedAt: true,
      assignedToId: true,
      createdById: true,
      companyId: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      company: { select: { code: true, name: true } },
      comments: { orderBy: { createdAt: "asc" }, select: { id: true, authorId: true, body: true, createdAt: true } },
    },
  });
  if (!task) throw new NotFoundError("Task not found.");

  const names = await resolveUserNames([
    task.assignedToId,
    task.createdById,
    ...task.comments.map((c) => c.authorId),
  ]);

  return {
    ...task,
    assignedToName: task.assignedToId ? (names.get(task.assignedToId) ?? null) : null,
    createdByName: names.get(task.createdById) ?? "Unknown",
    isOverdue: isOverdue(task.dueDate, task.status),
    comments: task.comments.map((c) => ({
      ...c,
      authorName: names.get(c.authorId) ?? "Unknown",
    })),
  };
}

export async function createTask(ctx: ActorContext, input: TaskInput) {
  requireCompanyAccess(ctx, input.companyId);

  // Assigning to someone else is a separate permission from creating.
  if (input.assignedToId && input.assignedToId !== ctx.userId) {
    if (!ctx.permissions.has("tasks.assign")) {
      throw new ForbiddenError("You cannot assign tasks to other people.");
    }
    await assertAssigneeExists(input.assignedToId);
  }

  return prisma.$transaction(async (tx) => {
    const taskNo = await nextTaskNo(tx);

    return tx.task.create({
      data: {
        taskNo,
        companyId: input.companyId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assignedToId: input.assignedToId ?? null,
        createdById: ctx.userId,
        dueDate: input.dueDate ?? null,
        followUpDate: input.followUpDate ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      },
      select: { id: true, taskNo: true, title: true, companyId: true },
    });
  });
}

export async function updateTask(ctx: ActorContext, input: TaskInput & { id: string }) {
  const before = await getTask(ctx, input.id);
  requireCompanyAccess(ctx, input.companyId);

  if (
    input.assignedToId &&
    input.assignedToId !== before.assignedToId &&
    input.assignedToId !== ctx.userId &&
    !ctx.permissions.has("tasks.assign")
  ) {
    throw new ForbiddenError("You cannot assign tasks to other people.");
  }
  if (input.assignedToId) await assertAssigneeExists(input.assignedToId);

  const after = await prisma.task.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assignedToId: input.assignedToId ?? null,
      dueDate: input.dueDate ?? null,
      followUpDate: input.followUpDate ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      // completedAt tracks the transition, so reopening clears it.
      completedAt:
        input.status === "COMPLETED"
          ? (before.completedAt ?? new Date())
          : null,
    },
    select: { id: true, taskNo: true, title: true, status: true, companyId: true },
  });

  return { before, after };
}

export async function setTaskStatus(ctx: ActorContext, input: { id: string; status: TaskStatus }) {
  const before = await getTask(ctx, input.id);

  const after = await prisma.task.update({
    where: { id: input.id },
    data: {
      status: input.status,
      completedAt: input.status === "COMPLETED" ? (before.completedAt ?? new Date()) : null,
    },
    select: { id: true, taskNo: true, title: true, status: true, companyId: true },
  });

  return { before: { status: before.status }, after: { status: after.status }, task: after };
}

export async function addTaskComment(
  ctx: ActorContext,
  input: { taskId: string; body: string },
) {
  // Confirms scope and visibility before allowing a comment.
  const task = await getTask(ctx, input.taskId);

  const comment = await prisma.taskComment.create({
    data: { taskId: input.taskId, authorId: ctx.userId, body: input.body },
    select: { id: true, createdAt: true },
  });

  return { comment, task };
}

export async function deleteTask(ctx: ActorContext, id: string) {
  const task = await getTask(ctx, id);

  // Comments cascade; the audit entry retains what was removed.
  await prisma.task.delete({ where: { id } });
  return task;
}

async function assertAssigneeExists(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("The selected assignee is not an active user.");
}

/** Assignable users, for the task form. */
export async function assignableUsers(ctx: ActorContext) {
  void ctx;
  return prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, email: true },
  });
}

export type TaskCounts = {
  open: number;
  overdue: number;
  dueToday: number;
  mine: number;
};

export async function taskCounts(ctx: ActorContext): Promise<TaskCounts> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const base = { ...companyScopeWhere(ctx), ...visibilityWhere(ctx) };

  const [open, overdue, dueToday, mine] = await Promise.all([
    prisma.task.count({ where: { ...base, status: { notIn: CLOSED_STATUSES } } }),
    prisma.task.count({
      where: { ...base, status: { notIn: CLOSED_STATUSES }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: {
        ...base,
        status: { notIn: CLOSED_STATUSES },
        dueDate: { gte: now, lte: endOfToday },
      },
    }),
    prisma.task.count({
      where: { ...base, status: { notIn: CLOSED_STATUSES }, assignedToId: ctx.userId },
    }),
  ]);

  return { open, overdue, dueToday, mine };
}

/** Overdue tasks for the dashboard feed. */
export async function overdueTasks(ctx: ActorContext, limit = 8) {
  const rows = await prisma.task.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...visibilityWhere(ctx),
      status: { notIn: CLOSED_STATUSES },
      dueDate: { lt: new Date() },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    select: {
      id: true,
      taskNo: true,
      title: true,
      priority: true,
      dueDate: true,
      assignedToId: true,
    },
  });

  const names = await resolveUserNames(rows.map((r) => r.assignedToId));

  return rows.map((t) => ({
    ...t,
    assignedToName: t.assignedToId ? (names.get(t.assignedToId) ?? null) : null,
  }));
}
