import { z } from "zod";
import { isValidIp, normaliseMac } from "./infrastructure";

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

/** Accepts the usual separators; stored uppercase and colon-delimited. */
const optionalMac = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || normaliseMac(v) !== null, "Enter a valid MAC address")
  .transform((v) => (v === undefined ? undefined : (normaliseMac(v) ?? undefined)));

const optionalIp = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || isValidIp(v), "Enter a valid IP address");

// --- Assets ------------------------------------------------------------------

export const ASSET_TYPES = [
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "PRINTER",
  "MOBILE",
  "TABLET",
  "IP_PHONE",
  "CCTV_CAMERA",
  "CCTV_RECORDER",
  "NETWORK",
  "SERVER",
  "PERIPHERAL",
  "OTHER",
] as const;

/** How each type reads on screen. "Cctv camera" is what a naive title-case gives. */
export const ASSET_TYPE_LABELS: Record<(typeof ASSET_TYPES)[number], string> = {
  LAPTOP: "Laptop",
  DESKTOP: "Desktop",
  MONITOR: "Monitor",
  PRINTER: "Printer",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  IP_PHONE: "IP Phone",
  CCTV_CAMERA: "CCTV Camera",
  CCTV_RECORDER: "CCTV Recorder (NVR/DVR)",
  NETWORK: "Network",
  SERVER: "Server",
  PERIPHERAL: "Peripheral",
  OTHER: "Other",
};

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type as (typeof ASSET_TYPES)[number]] ?? type;
}

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
    macAddress: optionalMac,
    ipAddress: optionalIp,
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
