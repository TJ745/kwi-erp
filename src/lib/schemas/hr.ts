import { z } from "zod";

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

export const CONTRACT_TYPES = [
  "PERMANENT",
  "FIXED_TERM",
  "PROBATION",
  "TEMPORARY",
  "CONSULTANCY",
] as const;

export const CONTRACT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "RENEWED",
] as const;

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

export const updateContractSchema = contractSchemaObject.extend({ id: z.string().min(1) }).superRefine(checkContractDates);

// --- Leave -------------------------------------------------------------------

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export const leaveRequestSchema = z
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
  })
  .strict()
  .refine((d) => d.endDate.getTime() >= d.startDate.getTime(), {
    message: "End date cannot precede the start date",
    path: ["endDate"],
  });

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

// --- Checklists --------------------------------------------------------------

export const CHECKLIST_TYPES = ["ONBOARDING", "OFFBOARDING", "CLEARANCE"] as const;

/** Mirrors the Prisma enum, but declared here so the UI layer never imports
 *  generated code (docs/ARCHITECTURE.md §4). */
export type ChecklistTypeValue = (typeof CHECKLIST_TYPES)[number];

export const CHECKLIST_ITEM_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "NOT_APPLICABLE",
  "BLOCKED",
] as const;

export const startChecklistSchema = z
  .object({
    employeeId: z.string().min(1),
    templateId: z.string().min(1, "Select a template"),
    targetDate: optionalDate,
  })
  .strict();

export const checklistItemSchema = z
  .object({
    itemId: z.string().min(1),
    status: z.enum(CHECKLIST_ITEM_STATUSES),
    notes: optionalText(500),
  })
  .strict();

export const completeChecklistSchema = z.object({ instanceId: z.string().min(1) }).strict();
