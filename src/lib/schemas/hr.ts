import { z } from "zod";
import { leaveFormSchema } from "@/lib/leave-form";
import { HOURS_PER_DAY, MAX_CHILDREN, TERM_YEARS, WORK_DAYS } from "@/lib/employment-contract";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

/** Money as a string from the form; kept out of float arithmetic entirely. */
const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

// --- Contracts ---------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max).default("");

/** The employee's particulars and ticket family, as printed in the contract. */
export const contractParticularsSchema = z
  .object({
    nameEn: text(200),
    nameAr: text(200),
    nationalityEn: text(60),
    nationalityAr: text(60),
    iqamaNo: text(30),
    passportNo: text(30),
    dateOfBirth: text(20),
    homeAddressEn: text(300),
    homeAddressAr: text(300),
    saudiAddressEn: text(300),
    saudiAddressAr: text(300),
    homePhone: text(40),
    ticketDestinationEn: text(80),
    ticketDestinationAr: text(80),
    ticketWife: z.boolean().default(false),
    ticketChildren: z.coerce.number().int().min(0).max(MAX_CHILDREN).default(0),
  })
  .strict();
export type ContractParticulars = z.infer<typeof contractParticularsSchema>;

const oneOf = (values: readonly number[], message: string) =>
  z.coerce.number().refine((v) => values.includes(v), message);

export const CONTRACT_TYPES = [
  "PERMANENT",
  "FIXED_TERM",
  "PROBATION",
  "TEMPORARY",
  "CONSULTANCY",
] as const;

export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"] as const;

const contractSchemaObject = z
  .object({
    employeeId: z.string().min(1),
    companyId: z.string().min(1, "Company is required"),
    contractType: z.enum(CONTRACT_TYPES),
    startDate: requiredDate,
    endDate: optionalDate,
    probationEndDate: optionalDate,
    basicSalary: optionalMoney,
    housingAllowance: optionalMoney,
    transportAllowance: optionalMoney,
    otherAllowance: optionalMoney,
    currency: z.string().trim().length(3).default("SAR"),
    status: z.enum(CONTRACT_STATUSES).default("ACTIVE"),
    notes: optionalText(1000),
    // The printed contract.
    contractDate: optionalDate,
    positionTitle: optionalText(150),
    jobDescriptionId: optionalText(60),
    termYears: oneOf(TERM_YEARS, "Choose 1 or 2 years").default(1),
    workDaysPerWeek: oneOf(WORK_DAYS, "Choose 5 or 6 days").default(5),
    hoursPerDay: oneOf(HOURS_PER_DAY, "Choose 8, 9 or 10 hours").default(8),
    particulars: contractParticularsSchema.optional(),
  })
  .strict();

/**
 * Cross-field rules, applied to create and update alike.
 *
 * Shared through a function rather than by intersecting schemas: an
 * intersection of a bare object with a strict one silently stops rejecting
 * unknown keys (verified — see storage of Phase 13 findings).
 */
function checkContractDates(
  d: {
    startDate: Date;
    endDate?: Date | undefined;
    probationEndDate?: Date | undefined;
    contractType: string;
  },
  ctx: z.RefinementCtx,
): void {
  if (d.endDate && d.endDate.getTime() < d.startDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "End date cannot precede the start date",
      path: ["endDate"],
    });
  }
  if (d.probationEndDate && d.probationEndDate.getTime() < d.startDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "Probation end cannot precede the start date",
      path: ["probationEndDate"],
    });
  }
  // A fixed-term contract without an end date has no term — the expiry engine
  // would never see it and it would never be renewed.
  if (d.contractType === "FIXED_TERM" && !d.endDate) {
    ctx.addIssue({
      code: "custom",
      message: "A fixed-term contract must have an end date",
      path: ["endDate"],
    });
  }
}

export const contractSchema = contractSchemaObject.superRefine(checkContractDates);

export type ContractInput = z.infer<typeof contractSchema>;

export const updateContractSchema = contractSchemaObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkContractDates);

// --- Leave -------------------------------------------------------------------

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

const leaveRequestObject = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    leaveTypeId: z.string().min(1, "Leave type is required"),
    startDate: requiredDate,
    endDate: requiredDate,
    reason: optionalText(1000),
    handoverToId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
    /** The printed form's other fields. */
    form: leaveFormSchema.optional(),
  })
  .strict();

const endAfterStart = (d: { startDate: Date; endDate: Date }) =>
  d.endDate.getTime() >= d.startDate.getTime();
const endAfterStartIssue = {
  message: "End date cannot precede the start date",
  path: ["endDate"],
};

export const leaveRequestSchema = leaveRequestObject.refine(endAfterStart, endAfterStartIssue);
export const updateLeaveRequestSchema = leaveRequestObject
  .extend({ id: z.string().min(1) })
  .refine(endAfterStart, endAfterStartIssue);

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

/** Approve/reject is deliberately a separate action from editing the request. */
export const leaveDecisionSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    comment: optionalText(500),
  })
  .strict()
  .refine((d) => d.decision !== "REJECTED" || Boolean(d.comment), {
    message: "A reason is required when rejecting",
    path: ["comment"],
  });

export const leaveCancelSchema = z.object({ id: z.string().min(1) }).strict();
