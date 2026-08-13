import { z } from "zod";

/**
 * Company certificates and electricity bills — brief §34, §35.
 *
 * Together because both are recurring obligations with a date the business
 * must not miss: a certificate expires, a bill falls due. They differ in what
 * happens next — a certificate feeds the expiry register, a bill feeds a
 * payment status.
 */

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

const requiredMoney = z
  .string()
  .min(1, "Amount is required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const BILL_STATUSES = ["PENDING", "PAID", "OVERDUE"] as const;

// --- Company certificates ----------------------------------------------------

const certificateObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    certificateTypeId: z.string().min(1, "Certificate type is required"),
    certificateNo: z.string().trim().min(1, "Certificate number is required").max(80),
    issueDate: requiredDate,
    expiryDate: requiredDate,
    issuingAuthority: optionalText(150),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
    notes: optionalText(1000),
  })
  .strict();

function checkCertificateDates(
  d: { issueDate: Date; expiryDate: Date },
  ctx: z.RefinementCtx,
): void {
  if (d.expiryDate.getTime() <= d.issueDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "Expiry must be after the issue date",
      path: ["expiryDate"],
    });
  }
}

export const certificateSchema = certificateObject.superRefine(checkCertificateDates);
export const updateCertificateSchema = certificateObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkCertificateDates);

export type CertificateInput = z.infer<typeof certificateSchema>;

// --- Electricity bills -------------------------------------------------------

const billObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    accommodationId: optionalId,
    location: z.string().trim().min(2, "Location is required").max(150),
    meterNumber: z.string().trim().min(1, "Meter number is required").max(60),
    billingPeriodStart: requiredDate,
    billingPeriodEnd: requiredDate,
    amount: requiredMoney,
    currency: z.string().trim().length(3).default("SAR"),
    dueDate: requiredDate,
    paidDate: optionalDate,
    status: z.enum(BILL_STATUSES).default("PENDING"),
    notes: optionalText(1000),
  })
  .strict();

function checkBill(
  d: {
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    status: string;
    paidDate?: Date | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (d.billingPeriodEnd.getTime() < d.billingPeriodStart.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "The billing period cannot end before it starts",
      path: ["billingPeriodEnd"],
    });
  }
  // A paid bill without a payment date cannot be reconciled against a bank
  // statement, which is the entire point of recording it.
  if (d.status === "PAID" && !d.paidDate) {
    ctx.addIssue({
      code: "custom",
      message: "A paid bill needs its payment date",
      path: ["paidDate"],
    });
  }
  if (d.status !== "PAID" && d.paidDate) {
    ctx.addIssue({
      code: "custom",
      message: "Only a paid bill can have a payment date",
      path: ["status"],
    });
  }
}

export const billSchema = billObject.superRefine(checkBill);
export const updateBillSchema = billObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkBill);

export type BillInput = z.infer<typeof billSchema>;

export const complianceIdSchema = z.object({ id: z.string().min(1) }).strict();

export const markBillPaidSchema = z
  .object({
    id: z.string().min(1),
    paidDate: requiredDate,
  })
  .strict();
