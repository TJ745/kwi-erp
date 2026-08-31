import { z } from "zod";
import { LETTERHEAD_SLOTS } from "@/lib/letterhead";

/** Shared by forms and server actions. Always `.strict()` — an unknown key is
 *  a validation error, not a silent mass-assignment (docs/SECURITY.md §4). */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const companySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "At least 2 characters")
      .max(10, "At most 10 characters")
      .regex(/^[A-Z0-9-]+$/, "Uppercase letters, digits, and hyphens only"),
    name: z.string().trim().min(2, "Company name is required").max(200),
    nameAr: optionalText(200),
    shortName: z.string().trim().min(1, "Short name is required").max(50),
    registrationNo: optionalText(50),
    crNumber: optionalText(50),
    vatNumber: optionalText(50),
    addressLine: optionalText(300),
    city: optionalText(100),
    country: z.string().trim().length(2, "Use a 2-letter country code").default("SA"),
    phone: optionalText(50),
    email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
    website: optionalText(200),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
    notes: optionalText(2000),
  })
  .strict();

export type CompanyInput = z.infer<typeof companySchema>;

export const updateCompanySchema = companySchema
  .extend({ id: z.string().min(1) })
  .strict();

/** Which piece of letterhead is being set. Mirrors LETTERHEAD_SLOTS, which is
 *  where the slot's meaning lives. */
export const brandingSlotSchema = z.enum(LETTERHEAD_SLOTS);

/**
 * Letterhead artwork. A null fileId clears the slot — the same action both
 * sets and removes, so there is one permission check and one audit shape
 * rather than two of each.
 */
export const companyBrandingSchema = z
  .object({
    companyId: z.string().min(1),
    slot: brandingSlotSchema,
    fileId: z.string().min(1).nullable(),
  })
  .strict();

export const departmentSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .max(20)
      .regex(/^[A-Z0-9-]+$/, "Uppercase letters, digits, and hyphens only"),
    name: z.string().trim().min(2, "Name is required").max(150),
    nameAr: optionalText(150),
    parentId: z.string().optional().transform((v) => (v === "" || v === "none" ? undefined : v)),
    headEmployeeId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  })
  .strict();

export type DepartmentInput = z.infer<typeof departmentSchema>;

export const updateDepartmentSchema = departmentSchema
  .extend({ id: z.string().min(1) })
  .strict();

export const positionSchema = z
  .object({
    // Null/absent means the position is shared across every company.
    companyId: z.string().optional().transform((v) => (v === "" || v === "all" ? undefined : v)),
    title: z.string().trim().min(2, "Title is required").max(150),
    titleAr: optionalText(150),
    grade: optionalText(50),
    /** Seats the role is budgeted for. 0 keeps it off the structure chart. */
    budgetedHeadcount: z.coerce
      .number()
      .int("Whole seats only")
      .min(0, "Cannot be negative")
      .max(9999, "That is not a headcount")
      .default(0),
    /** The role this one reports to, for placing vacancies. "none" clears it. */
    reportsToPositionId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  })
  .strict();

export type PositionInput = z.infer<typeof positionSchema>;

export const updatePositionSchema = positionSchema
  .extend({ id: z.string().min(1) })
  .strict();
