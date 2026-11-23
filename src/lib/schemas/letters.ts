import { z } from "zod";

export const LETTER_TYPES = [
  "JOB_OFFER",
  "EMPLOYMENT_LETTER",
  "SALARY_LETTER",
  "EXPERIENCE_LETTER",
  "WARNING_LETTER",
  "VEHICLE_HANDOVER",
  "ASSET_HANDOVER",
  "RETURN_CONFIRMATION",
  "MEMO",
  "OTHER",
] as const;

export const LETTER_TYPE_LABELS: Record<(typeof LETTER_TYPES)[number], string> = {
  JOB_OFFER: "Job offer",
  EMPLOYMENT_LETTER: "Employment letter",
  SALARY_LETTER: "Salary certificate",
  EXPERIENCE_LETTER: "Experience letter",
  WARNING_LETTER: "Warning letter",
  VEHICLE_HANDOVER: "Vehicle handover",
  ASSET_HANDOVER: "Asset handover",
  RETURN_CONFIRMATION: "Return confirmation",
  MEMO: "Memo",
  OTHER: "Other",
};

/**
 * Types that print as FORMS rather than prose.
 *
 * The distinction is not cosmetic. A form is a dense grid of short labelled
 * boxes, printed to be filled in and signed by hand, and it is expected to fit
 * on a single sheet that routes between departments. A letter is prose, read
 * once, and wants generous margins. Feeding both through the same page setup
 * makes one of them wrong — at letter margins a handover form runs onto a
 * second page, and a two-page form is a second sheet to chase signatures on.
 */
export const FORM_LETTER_TYPES = [
  "VEHICLE_HANDOVER",
  "ASSET_HANDOVER",
  "RETURN_CONFIRMATION",
] as const;

export function isFormLetter(type: string): boolean {
  return (FORM_LETTER_TYPES as readonly string[]).includes(type);
}

/** "" is what an unselected <select> submits; it means "no company", not a blank id. */
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

export const createTemplateSchema = z
  .object({
    // Stable machine key: seeds and future automations reference templates by
    // key, not by name, so renaming a template does not break them.
    key: z
      .string()
      .trim()
      .min(3, "Key is required")
      .max(60)
      .regex(/^[a-z][a-z0-9_-]*$/, "Use lowercase letters, digits, hyphen or underscore"),
    name: z.string().trim().min(3, "Name is required").max(150),
    type: z.enum(LETTER_TYPES),
    companyId: optionalId,
    bodyHtml: z.string().trim().min(10, "The letter body is required").max(50_000),
    bodyHtmlAr: z
      .string()
      .trim()
      .max(50_000)
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateTemplateSchema = createTemplateSchema.extend({
  id: z.string().min(1),
});

export const generateLetterSchema = z
  .object({
    templateId: z.string().min(1, "Choose a template"),
    employeeId: z.string().min(1, "Choose an employee"),
  })
  .strict();

export const letterIdSchema = z.object({ id: z.string().min(1) }).strict();

export const setLetterStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["GENERATED", "ISSUED", "CANCELLED"]),
  })
  .strict();

export type TemplateFormValues = z.input<typeof createTemplateSchema> & { id?: string };
