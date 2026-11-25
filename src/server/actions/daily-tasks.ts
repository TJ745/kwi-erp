"use server";

import {
  dailyTaskIdSchema,
  dailyTaskSchema,
  dailyTaskStatusSchema,
  updateDailyTaskSchema,
} from "@/lib/schemas/tasks";
import { defineAction } from "./define-action";
import {
  createDailyTask,
  deleteDailyTask,
  setDailyTaskStatus,
  updateDailyTask,
} from "@/server/services/daily-tasks";

// Everyone who can open the app keeps their own task list.
const PERMISSION = "dashboard.view";
const PATHS = ["/tasks", "/dashboard"];
const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

export const createDailyTaskAction = defineAction({
  permission: PERMISSION,
  schema: dailyTaskSchema,
  audit: { action: "CREATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const t = await createDailyTask(ctx, input);
    audit.record({ entityId: t.id, summary: `Recorded task: ${short(t.description)}` });
    return { id: t.id };
  },
  revalidate: () => PATHS,
});

export const updateDailyTaskAction = defineAction({
  permission: PERMISSION,
  schema: updateDailyTaskSchema,
  audit: { action: "UPDATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const t = await updateDailyTask(ctx, input);
    audit.record({
      entityId: t.id,
      summary: `Updated task: ${short(t.description)}`,
      before: { status: t.before },
      after: { status: t.after },
    });
    return { id: t.id };
  },
  revalidate: () => PATHS,
});

export const setDailyTaskStatusAction = defineAction({
  permission: PERMISSION,
  schema: dailyTaskStatusSchema,
  audit: { action: "UPDATE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const t = await setDailyTaskStatus(ctx, input);
    audit.record({
      entityId: t.id,
      summary: `${t.status === "COMPLETED" ? "Completed" : "Reopened"} task: ${short(t.description)}`,
    });
    return { id: t.id };
  },
  revalidate: () => PATHS,
});

export const deleteDailyTaskAction = defineAction({
  permission: PERMISSION,
  schema: dailyTaskIdSchema,
  audit: { action: "DELETE", entity: "TASK" },
  handler: async ({ input, ctx, audit }) => {
    const t = await deleteDailyTask(ctx, input.id);
    audit.record({ entityId: t.id, summary: `Deleted pending task: ${short(t.description)}` });
    return { id: t.id };
  },
  revalidate: () => PATHS,
});
