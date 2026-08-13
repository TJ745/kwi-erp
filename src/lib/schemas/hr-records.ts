import { z } from "zod";

/** Warnings, correspondence, increments, and evaluations — brief §19–§22. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === "none" || v === undefined ? undefined : v));

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

const money = z
  .string()
  .min(1, "Amount is required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

export const WARNING_LEVELS = [
  "VERBAL",
  "FIRST_WRITTEN",
  "SECOND_WRITTEN",
  "FINAL",
] as const;

export const CORRESPONDENCE_TYPES = [
  "IQAMA_RENEWAL",
  "VISA",
  "GOVERNMENT",
  "INSURANCE",
  "BANK",
  "INTERNAL",
  "SUPPLIER",
  "OTHER",
] as const;

export const CORRESPONDENCE_STATUSES = [
  "DRAFT",
  "SENT",
  "WAITING",
  "FOLLOW_UP_REQUIRED",
  "COMPLETED",
] as const;

// --- Warning letters ---------------------------------------------------------

export const warningSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    level: z.enum(WARNING_LEVELS),
    reason: z.string().trim().min(3, "Reason is required").max(200),
    description: z.string().trim().min(10, "Describe what happened").max(4000),
    issuedDate: requiredDate,
  })
  .strict();

export const updateWarningSchema = warningSchema.extend({ id: z.string().min(1) });

export type WarningInput = z.infer<typeof warningSchema>;

export const acknowledgeWarningSchema = z
  .object({
    id: z.string().min(1),
    acknowledgedAt: requiredDate,
  })
  .strict();

// --- Correspondence ----------------------------------------------------------

const correspondenceObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    employeeId: optionalId,
    type: z.enum(CORRESPONDENCE_TYPES),
    subject: z.string().trim().min(3, "Subject is required").max(200),
    recipient: z.string().trim().min(2, "Recipient is required").max(200),
    sentDate: optionalDate,
    status: z.enum(CORRESPONDENCE_STATUSES).default("DRAFT"),
    followUpDate: optionalDate,
    notes: optionalText(2000),
  })
  .strict();

function checkCorrespondence(
  d: { status: string; sentDate?: Date | undefined; followUpDate?: Date | undefined },
  ctx: z.RefinementCtx,
): void {
  // "Sent" with no date cannot be chased or evidenced later.
  if (d.status !== "DRAFT" && !d.sentDate) {
    ctx.addIssue({
      code: "custom",
      message: "Record the date it was sent",
      path: ["sentDate"],
    });
  }
  // A follow-up flag with no date is a reminder nobody will ever get.
  if (d.status === "FOLLOW_UP_REQUIRED" && !d.followUpDate) {
    ctx.addIssue({
      code: "custom",
      message: "Set the date to follow up on",
      path: ["followUpDate"],
    });
  }
}

export const correspondenceSchema = correspondenceObject.superRefine(checkCorrespondence);
export const updateCorrespondenceSchema = correspondenceObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkCorrespondence);

export type CorrespondenceInput = z.infer<typeof correspondenceSchema>;

// --- Increments --------------------------------------------------------------

/**
 * `amount` and `percentage` are deliberately absent: they are derived on the
 * server from the two salaries so they cannot contradict them.
 */
export const incrementSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    currentSalary: money,
    newSalary: money,
    currency: z.string().trim().length(3).default("SAR"),
    effectiveDate: requiredDate,
    notes: optionalText(1000),
  })
  .strict();

export const updateIncrementSchema = incrementSchema.extend({ id: z.string().min(1) });

export type IncrementInput = z.infer<typeof incrementSchema>;

export const decideIncrementSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    notes: optionalText(500),
  })
  .strict();

// --- Evaluations -------------------------------------------------------------

const scoreEntry = z
  .object({
    criterion: z.string().trim().min(1, "Criterion is required").max(120),
    weight: z
      .string()
      .min(1, "Weight is required")
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Weight must be positive"),
    score: z
      .string()
      .min(1, "Score is required")
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid score"),
    comment: optionalText(500),
  })
  .strict();

const evaluationObject = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    evaluatorId: z.string().min(1, "Evaluator is required"),
    periodStart: requiredDate,
    periodEnd: requiredDate,
    summary: optionalText(4000),
    scores: z.array(scoreEntry).max(30).default([]),
  })
  .strict();

function checkEvaluation(
  d: { periodStart: Date; periodEnd: Date; employeeId: string; evaluatorId: string },
  ctx: z.RefinementCtx,
): void {
  if (d.periodEnd.getTime() < d.periodStart.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "The period cannot end before it starts",
      path: ["periodEnd"],
    });
  }
  // Self-assessment is a different artefact; a performance review is not it.
  if (d.employeeId === d.evaluatorId) {
    ctx.addIssue({
      code: "custom",
      message: "An employee cannot evaluate themselves",
      path: ["evaluatorId"],
    });
  }
}

export const evaluationSchema = evaluationObject.superRefine(checkEvaluation);
export const updateEvaluationSchema = evaluationObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkEvaluation);

export type EvaluationInput = z.infer<typeof evaluationSchema>;

export const decideEvaluationSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
  })
  .strict();

export const hrRecordIdSchema = z.object({ id: z.string().min(1) }).strict();
