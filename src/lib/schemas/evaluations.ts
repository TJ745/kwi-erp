import { z } from "zod";
import { EVALUATION_TEMPLATES, staffDataSchema, workerDataSchema } from "@/lib/evaluation-forms";

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const evaluationListSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(200),
    listDate: requiredDate,
    notes: optionalText(1000),
  })
  .strict();
export const updateEvaluationListSchema = evaluationListSchema.extend({ id: z.string().min(1) });
export type EvaluationListInput = z.infer<typeof evaluationListSchema>;

export const addEvaluationSchema = z
  .object({
    listId: z.string().min(1),
    employeeId: z.string().min(1, "Choose the employee"),
    template: z.enum(EVALUATION_TEMPLATES),
    evaluationDate: requiredDate,
  })
  .strict();
export type AddEvaluationInput = z.infer<typeof addEvaluationSchema>;

export const saveStaffEvaluationSchema = z
  .object({
    id: z.string().min(1),
    evaluationDate: requiredDate,
    managerId: optionalText(60),
    timeInPosition: optionalText(100),
    pdpStarted: optionalDate,
    pdpCompleted: optionalDate,
    data: staffDataSchema,
    managerComments: optionalText(5000),
    employeeComments: optionalText(5000),
    finalRating: optionalText(50),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.pdpStarted && d.pdpCompleted && d.pdpCompleted < d.pdpStarted) {
      ctx.addIssue({
        code: "custom",
        path: ["pdpCompleted"],
        message: "PDP completed cannot be before PDP started",
      });
    }
  });
export type SaveStaffEvaluationInput = z.infer<typeof saveStaffEvaluationSchema>;

export const saveWorkerEvaluationSchema = z
  .object({
    id: z.string().min(1),
    evaluationDate: requiredDate,
    section: optionalText(150),
    data: workerDataSchema,
  })
  .strict();
export type SaveWorkerEvaluationInput = z.infer<typeof saveWorkerEvaluationSchema>;

export const evaluationIdSchema = z.object({ id: z.string().min(1) }).strict();
