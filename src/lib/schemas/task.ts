import { z } from "zod";

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETED",
  "CANCELLED",
] as const;

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

/** Entities a task can be attached to (docs/DATABASE.md §15). */
export const TASK_ENTITY_TYPES = [
  "EMPLOYEE",
  "COMPANY",
  "VEHICLE",
  "IT_ASSET",
  "IT_TICKET",
  "SUPPLIER",
  "SUBCONTRACTOR",
  "MEDICAL_INSURANCE_POLICY",
  "COMPANY_CERTIFICATE",
] as const;

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === "none" ? undefined : v));

export const taskSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    title: z.string().trim().min(3, "Title is required").max(200),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(TASK_STATUSES).default("TODO"),
    priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
    assignedToId: optionalId,
    dueDate: optionalDate,
    followUpDate: optionalDate,
    entityType: z.enum(TASK_ENTITY_TYPES).optional().or(z.literal("").transform(() => undefined)),
    entityId: optionalId,
  })
  .strict()
  .refine((d) => !d.entityType || Boolean(d.entityId), {
    message: "Select the related record",
    path: ["entityId"],
  })
  .refine((d) => !d.entityId || Boolean(d.entityType), {
    message: "Select the related record type",
    path: ["entityType"],
  });

export type TaskInput = z.infer<typeof taskSchema>;

export const updateTaskSchema = z.object({ id: z.string().min(1) }).and(taskSchema);

/** Quick status change from the list, without opening the full form. */
export const taskStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(TASK_STATUSES),
  })
  .strict();

export const taskCommentSchema = z
  .object({
    taskId: z.string().min(1),
    body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  })
  .strict();
