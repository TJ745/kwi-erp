import { z } from "zod";

export const DAILY_TASK_STATUSES = ["PENDING", "COMPLETED"] as const;
export type DailyTaskStatus = (typeof DAILY_TASK_STATUSES)[number];

export const DAILY_TASK_STATUS_LABELS: Record<DailyTaskStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
};

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

export const dailyTaskSchema = z
  .object({
    taskDate: requiredDate,
    description: z.string().trim().min(2, "Describe the task").max(2000),
    receivedFrom: z.string().trim().min(2, "Who gave you the task?").max(150),
    remarks: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v ? v : null)),
    status: z.enum(DAILY_TASK_STATUSES).default("PENDING"),
  })
  .strict();
export type DailyTaskInput = z.infer<typeof dailyTaskSchema>;

export const updateDailyTaskSchema = dailyTaskSchema.extend({ id: z.string().min(1) }).strict();

export const dailyTaskStatusSchema = z
  .object({ id: z.string().min(1), status: z.enum(DAILY_TASK_STATUSES) })
  .strict();

export const dailyTaskIdSchema = z.object({ id: z.string().min(1) }).strict();

/** The list's filters, read from the URL (page and export alike). */
export type DailyTaskFilters = {
  status?: DailyTaskStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
};

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

export function readTaskFilters(params: Record<string, string | string[] | undefined>) {
  const one = (k: string) => {
    const v = params[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const status = one("status");
  const from = one("from");
  const to = one("to");
  return {
    status: (DAILY_TASK_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as DailyTaskStatus)
      : undefined,
    from: from && isoDay.test(from) ? from : undefined,
    to: to && isoDay.test(to) ? to : undefined,
    q: one("q")?.slice(0, 100),
  } satisfies DailyTaskFilters;
}
