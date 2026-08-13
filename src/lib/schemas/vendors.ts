import { z } from "zod";

/**
 * Suppliers and subcontractors — brief §29, §30.
 *
 * Kept in one file because they share shape and are managed by the same people;
 * a subcontractor differs from a supplier chiefly in having contracts with a
 * term, which is what puts it on the expiry register.
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

const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const PAYMENT_TYPES = ["CASH", "CREDIT"] as const;
export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"] as const;

/** Shared by both: a human-facing code people read out over the phone. */
const codeField = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits, and hyphens only")
  .transform((v) => v.toUpperCase());

// --- Suppliers ---------------------------------------------------------------

const supplierObject = z
  .object({
    code: codeField,
    name: z.string().trim().min(2, "Name is required").max(150),
    contactPerson: optionalText(120),
    phone: optionalText(40),
    email: optionalEmail,
    companyId: optionalId,
    categoryId: optionalId,
    paymentType: z.enum(PAYMENT_TYPES).default("CASH"),
    creditDays: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
      .refine(
        (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 365),
        "Enter a whole number of days (0–365)",
      ),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
    notes: optionalText(1000),
  })
  .strict();

/** Credit terms without a period are not terms — the AP team cannot age them. */
function checkCreditTerms(
  d: { paymentType: string; creditDays?: number | undefined },
  ctx: z.RefinementCtx,
): void {
  if (d.paymentType === "CREDIT" && d.creditDays === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Credit suppliers need a credit period",
      path: ["creditDays"],
    });
  }
}

export const supplierSchema = supplierObject.superRefine(checkCreditTerms);
export const updateSupplierSchema = supplierObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkCreditTerms);

export type SupplierInput = z.infer<typeof supplierSchema>;

// --- Subcontractors ----------------------------------------------------------

const subcontractorObject = z
  .object({
    code: codeField,
    name: z.string().trim().min(2, "Name is required").max(150),
    contactPerson: optionalText(120),
    phone: optionalText(40),
    email: optionalEmail,
    crNumber: optionalText(40),
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
  })
  .strict();

function checkContractDates(
  d: { startDate: Date; endDate: Date },
  ctx: z.RefinementCtx,
): void {
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

export const vendorIdSchema = z.object({ id: z.string().min(1) }).strict();
