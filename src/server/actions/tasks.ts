"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  taskCommentSchema,
  taskSchema,
  taskStatusSchema,
  updateTaskSchema,
} from "@/lib/schemas/task";
import {
  addTaskComment,
  createTask,
  deleteTask,
  setTaskStatus,
  updateTask,
} from "@/server/services/tasks";

export const createTaskAction = defineAction({
  permission: "tasks.create",
  schema: taskSchema,
  audit: { action: "CREATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const task = await createTask(ctx, input);
    audit.record({
      entityId: task.id,
      companyId: task.companyId,
      summary: `Created task ${task.taskNo} — ${task.title}`,
      after: { title: task.title, status: input.status, priority: input.priority },
    });
    return { id: task.id, taskNo: task.taskNo };
  },
  revalidate: () => ["/tasks", "/dashboard"],
});

export const updateTaskAction = defineAction({
  permission: "tasks.update",
  schema: updateTaskSchema,
  audit: { action: "UPDATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateTask(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated task ${after.taskNo}`,
      before: {
        title: before.title,
        status: before.status,
        priority: before.priority,
        assignedToId: before.assignedToId,
        dueDate: before.dueDate,
      },
      after: {
        title: after.title,
        status: after.status,
        priority: input.priority,
        assignedToId: input.assignedToId ?? null,
        dueDate: input.dueDate ?? null,
      },
    });
    return { id: after.id };
  },
  revalidate: (input) => ["/tasks", `/tasks/${input.id}`, "/dashboard"],
});

export const setTaskStatusAction = defineAction({
  permission: "tasks.update",
  schema: taskStatusSchema,
  audit: { action: "UPDATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setTaskStatus(ctx, input);
    audit.record({
      entityId: input.id,
      companyId: result.task.companyId,
      summary: `Task ${result.task.taskNo}: ${result.before.status} → ${result.after.status}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/tasks", `/tasks/${input.id}`, "/dashboard"],
});

export const addTaskCommentAction = defineAction({
  permission: "tasks.view",
  schema: taskCommentSchema,
  audit: { action: "UPDATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const { task } = await addTaskComment(ctx, input);
    audit.record({
      entityId: input.taskId,
      companyId: task.companyId,
      summary: `Commented on task ${task.taskNo}`,
    });
    return { ok: true as const };
  },
  revalidate: (input) => [`/tasks/${input.taskId}`],
});

export const deleteTaskAction = defineAction({
  permission: "tasks.delete",
  schema: z.object({ id: z.string().min(1) }).strict(),
  audit: { action: "DELETE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const task = await deleteTask(ctx, input.id);
    audit.record({
      entityId: input.id,
      companyId: task.companyId,
      summary: `Deleted task ${task.taskNo} — ${task.title}`,
      before: { title: task.title, status: task.status },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/tasks", "/dashboard"],
});
