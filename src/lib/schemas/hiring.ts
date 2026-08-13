import { z } from "zod";

/** Job offers, job descriptions, and timesheets — brief §17, §18, §23. */

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

const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

const hours = z
  .string()
  .default("0")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter valid hours");

export const OFFER_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "WITHDRAWN",
  "CONVERTED",
] as const;

/** CONVERTED is reached only by converting, never by picking it in a form. */
export const SELECTABLE_OFFER_STATUSES = OFFER_STATUSES.filter(
  (s) => s !== "CONVERTED",
);

export const GENDERS = ["MALE", "FEMALE"] as const;
export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
] as const;

// --- Job descriptions --------------------------------------------------------

export const jobDescriptionSchema = z
  .object({
    companyId: optionalId,
    positionId: optionalId,
    title: z.string().trim().min(2, "Title is required").max(150),
    summary: optionalText(2000),
    responsibilities: optionalText(6000),
    requirements: optionalText(6000),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateJobDescriptionSchema = jobDescriptionSchema.extend({
  id: z.string().min(1),
});

export type JobDescriptionInput = z.infer<typeof jobDescriptionSchema>;

// --- Job offers --------------------------------------------------------------

const offerObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    candidateName: z.string().trim().min(2, "Candidate name is required").max(150),
    candidateEmail: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    candidatePhone: optionalText(40),
    positionId: optionalId,
    jobDescriptionId: optionalId,
    proposedSalary: optionalMoney,
    currency: z.string().trim().length(3).default("SAR"),
    proposedJoiningDate: optionalDate,
    status: z.enum(SELECTABLE_OFFER_STATUSES as unknown as [string, ...string[]]),
    sentAt: optionalDate,
    notes: optionalText(2000),
  })
  .strict();

function checkOffer(
  d: { status: string; sentAt?: Date | undefined },
  ctx: z.RefinementCtx,
): void {
  // An offer that reached the candidate has a date it reached them; without it
  // no expiry or follow-up can be reasoned about.
  if (d.status !== "DRAFT" && !d.sentAt) {
    ctx.addIssue({
      code: "custom",
      message: "Record when the offer was sent",
      path: ["sentAt"],
    });
  }
}

export const jobOfferSchema = offerObject.superRefine(checkOffer);
export const updateJobOfferSchema = offerObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkOffer);

export type JobOfferInput = z.infer<typeof jobOfferSchema>;

/**
 * Converting an accepted offer into an employee.
 *
 * The fields the offer cannot supply are collected here rather than guessed:
 * an Employee needs a real joining date, a gender, and a nationality, and
 * inventing any of them would put fiction into the permanent record.
 */
export const convertOfferSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    gender: z.enum(GENDERS),
    nationality: z
      .string()
      .trim()
      .length(2, "Use the two-letter country code")
      .transform((v) => v.toUpperCase()),
    joiningDate: requiredDate,
    employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
    departmentId: optionalId,
  })
  .strict();

// --- Timesheets --------------------------------------------------------------

export const timesheetEntrySchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    date: requiredDate,
    normalHours: hours,
    overtimeHours: hours,
    delayedHours: hours,
    absent: z.boolean().default(false),
    notes: optionalText(500),
  })
  .strict();

export const updateTimesheetEntrySchema = timesheetEntrySchema.extend({
  id: z.string().min(1),
});

export type TimesheetEntryInput = z.infer<typeof timesheetEntrySchema>;

export const decideTimesheetSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
  })
  .strict();

/** Approving a whole period at once — the normal end-of-month action. */
export const approvePeriodSchema = z
  .object({
    employeeId: z.string().min(1),
    from: requiredDate,
    to: requiredDate,
  })
  .strict();

export const hiringIdSchema = z.object({ id: z.string().min(1) }).strict();
