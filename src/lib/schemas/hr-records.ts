import { z } from "zod";

/** Warnings, increments, and evaluations — brief §19–§22. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

export const WARNING_LEVELS = ["VERBAL", "FIRST_WRITTEN", "SECOND_WRITTEN", "FINAL"] as const;

// --- Warning letters ---------------------------------------------------------

export const warningSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    level: z.enum(WARNING_LEVELS),
    reason: z.string().trim().min(3, "Reason is required").max(200),
    description: z.string().trim().min(10, "Describe what happened").max(4000),
    descriptionAr: z
      .string()
      .trim()
      .min(5, "The Arabic text is required — pick a reason or translate it")
      .max(4000),
    project: optionalText(150),
    issuedDate: requiredDate,
  })
  .strict();

export const updateWarningSchema = warningSchema.extend({ id: z.string().min(1) });

export type WarningInput = z.infer<typeof warningSchema>;

export const hrRecordIdSchema = z.object({ id: z.string().min(1) }).strict();
