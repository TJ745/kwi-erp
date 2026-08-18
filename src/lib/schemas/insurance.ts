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

const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

export const POLICY_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "PENDING_RENEWAL",
] as const;

export const providerSchema = z
  .object({
    name: z.string().trim().min(2, "Provider name is required").max(150),
    contactPerson: optionalText(120),
    phone: optionalText(40),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    isActive: z.boolean().default(true),
  })
  .strict();

export type ProviderInput = z.infer<typeof providerSchema>;

const policySchemaObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    providerId: z.string().min(1, "Select a provider"),
    policyNumber: z.string().trim().min(2, "Policy number is required").max(80),
    className: optionalText(60),
    startDate: requiredDate,
    expiryDate: requiredDate,
    status: z.enum(POLICY_STATUSES).default("ACTIVE"),
    /**
     * Distinct from status: brief §31 asks for Working / Not Working. A policy
     * can be in-date on paper yet not actually usable at a clinic, and the
     * administrator needs to record that separately.
     */
    isWorking: z.boolean().default(true),
    coverageLimit: optionalMoney,
    currency: z.string().trim().length(3).default("SAR"),
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
function checkPolicyDates(
  d: { startDate: Date; expiryDate: Date },
  ctx: z.RefinementCtx,
): void {
  if (d.expiryDate.getTime() < d.startDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "Expiry cannot precede the start date",
      path: ["expiryDate"],
    });
  }
}

export const policySchema = policySchemaObject.superRefine(checkPolicyDates);

export type PolicyInput = z.infer<typeof policySchema>;

export const updatePolicySchema = policySchemaObject.extend({ id: z.string().min(1) }).superRefine(checkPolicyDates);

/** Putting an employee on a policy. */
export const enrolmentSchema = z
  .object({
    policyId: z.string().min(1),
    employeeId: z.string().min(1, "Select an employee"),
    memberNumber: optionalText(50),
    className: optionalText(50),
    startDate: requiredDate,
    endDate: optionalDate,
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.endDate && d.endDate.getTime() < d.startDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "Cover cannot end before it starts",
        path: ["endDate"],
      });
    }
  });

export const endEnrolmentSchema = z
  .object({ id: z.string().min(1), policyId: z.string().min(1), endDate: requiredDate })
  .strict();
