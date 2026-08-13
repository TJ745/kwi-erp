import { z } from "zod";

/** Document types and checklist templates — brief §12, §14, §39. */

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === "none" || v === undefined ? undefined : v));

export const ENTITY_TYPES = [
  "EMPLOYEE",
  "COMPANY",
  "VEHICLE",
  "IT_ASSET",
  "SUPPLIER",
  "SUBCONTRACTOR",
  "CONTRACT",
] as const;

export const CHECKLIST_TYPES = ["ONBOARDING", "OFFBOARDING", "CLEARANCE"] as const;

/** Mirrors the ChecklistCategory enum; it drives the clearance-form grouping. */
export const CHECKLIST_CATEGORIES = [
  "HR",
  "IT",
  "ADMIN",
  "FINANCE",
  "ACCOMMODATION",
  "FLEET",
  "MANAGEMENT",
] as const;

// --- Document types ----------------------------------------------------------

export const documentTypeSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2, "Key is required")
      .max(50)
      .regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase letters, digits, and underscores")
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(2, "Name is required").max(120),
    appliesTo: z
      .array(z.enum(ENTITY_TYPES))
      .min(1, "Choose at least one entity this applies to"),
    requiresExpiry: z.boolean().default(false),
    /**
     * Reminder thresholds in days. Sorted descending and de-duplicated so the
     * reminder engine reads them in a predictable order.
     */
    defaultWarningDays: z
      .string()
      .default("90,60,30,15,7,1")
      .transform((v) =>
        [
          ...new Set(
            v
              .split(",")
              .map((d) => Number(d.trim()))
              .filter((d) => Number.isInteger(d) && d > 0 && d <= 365),
          ),
        ].sort((a, b) => b - a),
      )
      .refine((v) => v.length > 0, "Enter at least one threshold in days"),
  })
  .strict();

export const updateDocumentTypeSchema = documentTypeSchema.extend({
  id: z.string().min(1),
});

export type DocumentTypeInput = z.infer<typeof documentTypeSchema>;

// --- Checklist templates -----------------------------------------------------

const checklistItemSchema = z
  .object({
    label: z.string().trim().min(2, "Label is required").max(200),
    category: z.enum(CHECKLIST_CATEGORIES),
    requiresAttachment: z.boolean().default(false),
    requiresDate: z.boolean().default(false),
    defaultDueDays: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
      .refine(
        (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 365),
        "Enter a whole number of days up to 365",
      ),
    responsibleDepartmentId: optionalId,
  })
  .strict();

export const checklistTemplateSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2, "Key is required")
      .max(60)
      .regex(/^[a-z][a-z0-9_-]*$/, "Use lowercase letters, digits, hyphen or underscore"),
    name: z.string().trim().min(2, "Name is required").max(120),
    type: z.enum(CHECKLIST_TYPES),
    companyId: optionalId,
    isActive: z.boolean().default(true),
    items: z.array(checklistItemSchema).min(1, "A checklist needs at least one item").max(60),
  })
  .strict();

export const updateChecklistTemplateSchema = checklistTemplateSchema.extend({
  id: z.string().min(1),
});

export type ChecklistTemplateInput = z.infer<typeof checklistTemplateSchema>;

export const platformIdSchema = z.object({ id: z.string().min(1) }).strict();
