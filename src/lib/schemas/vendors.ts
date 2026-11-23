import { z } from "zod";

/**
 * Subcontractors — brief §30.
 *
 * A subcontractor's contracts carry a term, which is what puts them on the
 * expiry register.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal("").transform(() => undefined));

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

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const RATE_UNITS = ["HOUR", "DAY", "MONTH", "LUMP_SUM"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

/** How a unit reads in the form and in the printed rate table. */
export const RATE_UNIT_LABELS: Record<
  RateUnit,
  { option: string; column: string; suffix: string }
> = {
  HOUR: { option: "Per hour", column: "Per hour", suffix: "/ hour" },
  DAY: { option: "Per day", column: "Per day", suffix: "/ day" },
  MONTH: { option: "Per month", column: "Per month", suffix: "/ month" },
  LUMP_SUM: { option: "Lump sum", column: "Amount", suffix: "lump sum" },
};

export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"] as const;

/** A human-facing code people read out over the phone. */
const codeField = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits, and hyphens only")
  .transform((v) => v.toUpperCase());

// --- Subcontractors ----------------------------------------------------------

const subcontractorObject = z
  .object({
    code: codeField,
    name: z.string().trim().min(2, "Name is required").max(150),
    contactPerson: optionalText(120),
    phone: optionalText(40),
    email: optionalEmail,
    crNumber: optionalText(40),
    address: optionalText(300),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
    notes: optionalText(1000),
  })
  .strict();

export const subcontractorSchema = subcontractorObject;
export const updateSubcontractorSchema = subcontractorObject.extend({
  id: z.string().min(1),
});

export type SubcontractorInput = z.infer<typeof subcontractorSchema>;

// --- Subcontractor contracts -------------------------------------------------

export const MAX_RATE_LINES = 30;

const rateLine = z
  .object({
    category: z.string().trim().min(1, "Category is required").max(150),
    rate: z
      .string()
      .trim()
      .min(1, "Rate is required")
      .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter a valid rate"),
    unit: z.enum(RATE_UNITS),
  })
  .strict();

/** Terms are stored one per line; blank lines carry no term. */
export function splitTerms(terms: string | null | undefined): string[] {
  return (terms ?? "")
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

const termsField = z
  .string()
  .max(20000)
  .optional()
  .transform((v) => {
    const lines = splitTerms(v);
    return lines.length > 0 ? lines.join("\n") : undefined;
  });

const contractObject = z
  .object({
    subcontractorId: z.string().min(1, "Subcontractor is required"),
    companyId: z.string().min(1, "Company is required"),
    contractNo: z.string().trim().min(1, "Contract number is required").max(60),
    scope: optionalText(1000),
    startDate: requiredDate,
    endDate: requiredDate,
    value: optionalMoney,
    currency: z.string().trim().length(3).default("SAR"),
    status: z.enum(CONTRACT_STATUSES).default("ACTIVE"),
    notes: optionalText(1000),
    agreementDate: optionalDate,
    rates: z
      .array(rateLine)
      .max(MAX_RATE_LINES, `At most ${String(MAX_RATE_LINES)} rate lines`)
      .default([]),
    terms: termsField,
  })
  .strict();

function checkContractDates(d: { startDate: Date; endDate: Date }, ctx: z.RefinementCtx): void {
  if (d.endDate.getTime() < d.startDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "End date cannot precede the start date",
      path: ["endDate"],
    });
  }
}

export const subcontractorContractSchema = contractObject.superRefine(checkContractDates);
export const updateSubcontractorContractSchema = contractObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkContractDates);

export type SubcontractorContractInput = z.infer<typeof subcontractorContractSchema>;

export const subcontractDefaultsSchema = z
  .object({ terms: z.string().max(20000) })
  .strict()
  .transform((d) => ({ terms: splitTerms(d.terms).join("\n") }));

export const vendorIdSchema = z.object({ id: z.string().min(1) }).strict();
