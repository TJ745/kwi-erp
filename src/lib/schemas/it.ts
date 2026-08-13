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

const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

// --- Assets ------------------------------------------------------------------

export const ASSET_TYPES = [
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "PRINTER",
  "MOBILE",
  "TABLET",
  "IP_PHONE",
  "NETWORK",
  "SERVER",
  "PERIPHERAL",
  "OTHER",
] as const;

export const ASSET_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "UNDER_REPAIR",
  "LOST",
  "RETIRED",
  "DISPOSED",
] as const;

export const ASSET_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

const assetSchemaObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    type: z.enum(ASSET_TYPES),
    brand: z.string().trim().min(1, "Brand is required").max(80),
    model: z.string().trim().min(1, "Model is required").max(120),
    serialNumber: optionalText(120),
    assetTag: optionalText(60),
    purchaseDate: optionalDate,
    purchaseCost: optionalMoney,
    warrantyExpiry: optionalDate,
    condition: z.enum(ASSET_CONDITIONS).default("GOOD"),
    location: optionalText(120),
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
function checkAssetDates(
  d: { purchaseDate?: Date | undefined; warrantyExpiry?: Date | undefined },
  ctx: z.RefinementCtx,
): void {
  if (
    d.purchaseDate &&
    d.warrantyExpiry &&
    d.warrantyExpiry.getTime() < d.purchaseDate.getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Warranty cannot expire before purchase",
      path: ["warrantyExpiry"],
    });
  }
}

export const assetSchema = assetSchemaObject.superRefine(checkAssetDates);

export type AssetInput = z.infer<typeof assetSchema>;

export const updateAssetSchema = assetSchemaObject.extend({ id: z.string().min(1) }).superRefine(checkAssetDates);

/** Handover-out. Accessories are free text so the form stays usable. */
export const assignAssetSchema = z
  .object({
    assetId: z.string().min(1),
    employeeId: z.string().min(1, "Select an employee"),
    conditionOut: z.enum(ASSET_CONDITIONS),
    accessories: optionalText(500),
    remarks: optionalText(1000),
  })
  .strict();

/** Handover-in. */
export const returnAssetSchema = z
  .object({
    assetId: z.string().min(1),
    conditionIn: z.enum(ASSET_CONDITIONS),
    missingAccessories: optionalText(500),
    remarks: optionalText(1000),
    /** Damaged or missing kit should not go straight back into the pool. */
    nextStatus: z.enum(["AVAILABLE", "UNDER_REPAIR", "LOST", "RETIRED"]).default("AVAILABLE"),
  })
  .strict();

export const assetStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(ASSET_STATUSES),
  })
  .strict();

// --- Helpdesk ----------------------------------------------------------------

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const ticketSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    categoryId: z.string().min(1, "Select a category"),
    subject: z.string().trim().min(3, "Subject is required").max(200),
    description: z.string().trim().min(1, "Describe the problem").max(4000),
    priority: z.enum(TICKET_PRIORITIES).default("MEDIUM"),
    departmentId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
    relatedAssetId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
  })
  .strict();

export type TicketInput = z.infer<typeof ticketSchema>;

export const ticketAssignSchema = z
  .object({
    id: z.string().min(1),
    assignedToId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
  })
  .strict();

export const ticketStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(TICKET_STATUSES),
    resolution: optionalText(2000),
  })
  .strict()
  // Closing a ticket without recording what fixed it destroys the value of
  // having a helpdesk at all.
  .refine((d) => (d.status !== "RESOLVED" && d.status !== "CLOSED") || Boolean(d.resolution), {
    message: "Record what resolved the issue",
    path: ["resolution"],
  });

export const ticketCommentSchema = z
  .object({
    ticketId: z.string().min(1),
    body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
    isInternal: z.boolean().default(false),
  })
  .strict();
