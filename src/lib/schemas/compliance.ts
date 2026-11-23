import { z } from "zod";

/** Company certificates — brief §34. */

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

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

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

export const complianceIdSchema = z.object({ id: z.string().min(1) }).strict();
