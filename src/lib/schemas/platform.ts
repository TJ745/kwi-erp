import { z } from "zod";

/** Document types — brief §12, §14. */

export const ENTITY_TYPES = [
  "EMPLOYEE",
  "COMPANY",
  "VEHICLE",
  "IT_ASSET",
  "SUBCONTRACTOR",
  "CONTRACT",
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

export const platformIdSchema = z.object({ id: z.string().min(1) }).strict();
