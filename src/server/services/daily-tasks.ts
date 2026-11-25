import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { ConflictError, NotFoundError } from "@/lib/result";
import type { DailyTaskFilters, DailyTaskInput, DailyTaskStatus } from "@/lib/schemas/tasks";

/**
 * Daily tasks: what the user was asked to do, by whom, and whether it is done.
 * Each user keeps their own list. Completed tasks are never deleted, so the
 * list stays a record of the work received and finished.
 */

const own = (ctx: ActorContext) => ({ userId: ctx.userId });

function whereFor(ctx: ActorContext, f: DailyTaskFilters): Prisma.DailyTaskWhereInput {
  return {
    ...own(ctx),
    ...(f.status ? { status: f.status } : {}),
    ...(f.from || f.to
      ? {
          taskDate: {
            ...(f.from ? { gte: new Date(f.from) } : {}),
            ...(f.to ? { lte: new Date(f.to) } : {}),
          },
        }
      : {}),
    ...(f.q
      ? {
          OR: [
            { description: { contains: f.q, mode: "insensitive" } },
            { receivedFrom: { contains: f.q, mode: "insensitive" } },
            { remarks: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listDailyTasks(ctx: ActorContext, f: DailyTaskFilters) {
  return prisma.dailyTask.findMany({
    where: whereFor(ctx, f),
    // Newest first; within a day, still-pending work above finished work.
    orderBy: [{ taskDate: "desc" }, { status: "asc" }, { createdAt: "desc" }],
    take: 2000,
    select: {
      id: true,
      taskDate: true,
      description: true,
      receivedFrom: true,
      remarks: true,
      status: true,
      completedAt: true,
    },
  });
}

export type DailyTaskRow = Awaited<ReturnType<typeof listDailyTasks>>[number];

/** Pending now, and received / completed this month. */
export async function dailyTaskCounts(ctx: ActorContext, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [pending, receivedThisMonth, completedThisMonth, overdue] = await Promise.all([
    prisma.dailyTask.count({ where: { ...own(ctx), status: "PENDING" } }),
    prisma.dailyTask.count({ where: { ...own(ctx), taskDate: { gte: monthStart } } }),
    prisma.dailyTask.count({
      where: { ...own(ctx), status: "COMPLETED", completedAt: { gte: monthStart } },
    }),
    // Pending for more than a week.
    prisma.dailyTask.count({
      where: {
        ...own(ctx),
        status: "PENDING",
        taskDate: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { pending, receivedThisMonth, completedThisMonth, overdue };
}

/** The oldest pending tasks, for the dashboard; `late` = waiting over a week. */
export async function pendingTasks(ctx: ActorContext, take = 6, now = new Date()) {
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const rows = await prisma.dailyTask.findMany({
    where: { ...own(ctx), status: "PENDING" },
    orderBy: [{ taskDate: "asc" }, { createdAt: "asc" }],
    take,
    select: { id: true, taskDate: true, description: true, receivedFrom: true },
  });
  return rows.map((t) => ({ ...t, late: t.taskDate.getTime() < weekAgo }));
}

/** Names typed before, offered as suggestions in "Received from". */
export async function taskSources(ctx: ActorContext) {
  const rows = await prisma.dailyTask.groupBy({
    by: ["receivedFrom"],
    where: own(ctx),
    _count: { _all: true },
    orderBy: { _count: { receivedFrom: "desc" } },
    take: 50,
  });
  return rows.map((r) => r.receivedFrom);
}

const completion = (status: DailyTaskStatus, before?: Date | null) =>
  status === "COMPLETED" ? { completedAt: before ?? new Date() } : { completedAt: null };

export async function createDailyTask(ctx: ActorContext, input: DailyTaskInput) {
  return prisma.dailyTask.create({
    data: { ...input, ...completion(input.status), userId: ctx.userId },
    select: { id: true, description: true },
  });
}

async function ownTask(ctx: ActorContext, id: string) {
  const task = await prisma.dailyTask.findFirst({
    where: { id, ...own(ctx) },
    select: { id: true, status: true, completedAt: true, description: true },
  });
  if (!task) throw new NotFoundError("Task not found.");
  return task;
}

export async function updateDailyTask(ctx: ActorContext, input: DailyTaskInput & { id: string }) {
  const before = await ownTask(ctx, input.id);
  const { id, ...data } = input;
  await prisma.dailyTask.update({
    where: { id },
    data: { ...data, ...completion(data.status, before.completedAt) },
  });
  return { id, description: data.description, before: before.status, after: data.status };
}

export async function setDailyTaskStatus(
  ctx: ActorContext,
  input: { id: string; status: DailyTaskStatus },
) {
  const before = await ownTask(ctx, input.id);
  await prisma.dailyTask.update({
    where: { id: input.id },
    data: { status: input.status, ...completion(input.status, before.completedAt) },
  });
  return { id: input.id, description: before.description, status: input.status };
}

/** Only a pending task can be deleted (a mistake); completed work stays on record. */
export async function deleteDailyTask(ctx: ActorContext, id: string) {
  const task = await ownTask(ctx, id);
  if (task.status === "COMPLETED") {
    throw new ConflictError("Completed tasks are kept on record and cannot be deleted.");
  }
  await prisma.dailyTask.delete({ where: { id } });
  return task;
}
