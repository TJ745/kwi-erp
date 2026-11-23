import { z } from "zod";

/** IT infrastructure: IP phones and CCTV, both layered over IT assets. */

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

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

/**
 * IPv4, or an IPv6-looking string.
 *
 * Deliberately permissive on v6 rather than wrong: a strict v6 grammar is easy
 * to get subtly incorrect, and rejecting an address the network team actually
 * uses is worse than accepting an odd one.
 */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isValidIp(value: string): boolean {
  const v4 = IPV4.exec(value);
  if (v4) {
    return v4.slice(1).every((part) => {
      const n = Number(part);
      // Rejects 999 and also 01, which some tools treat as octal.
      return n >= 0 && n <= 255 && String(n) === part;
    });
  }
  return value.includes(":") && /^[0-9a-fA-F:]+$/.test(value);
}

/** Accepts the usual separators; stored uppercase and colon-delimited. */
export function normaliseMac(value: string): string | null {
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12) return null;
  return (hex.match(/.{2}/g) ?? []).join(":");
}

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const CCTV_TYPES = ["DOME", "BULLET", "PTZ", "NVR", "DVR"] as const;
/** Only a recorder can have cameras pointed at it. */
export const RECORDER_TYPES = ["NVR", "DVR"] as const;

// --- IP phones ---------------------------------------------------------------

/**
 * An extension and the handset it rings on. The handset's model, MAC,
 * location, status and holder all live on the IT asset, so none of them are
 * asked for here.
 */
export const ipPhoneSchema = z
  .object({
    extension: z
      .string()
      .trim()
      .min(2, "Extension is required")
      .max(12)
      .regex(/^[0-9]+$/, "Extensions are digits only"),
    assetId: z.string().trim().min(1, "Select the handset"),
  })
  .strict();

export const updateIpPhoneSchema = ipPhoneSchema.extend({ id: z.string().min(1) });
export type IpPhoneInput = z.infer<typeof ipPhoneSchema>;

// --- CCTV --------------------------------------------------------------------

/**
 * The CCTV-specific part of a camera or recorder. The hardware — name, model,
 * location, IP, status — is the linked IT asset and is not asked for here.
 */
const cctvObject = z
  .object({
    assetId: z.string().trim().min(1, "Select the device from Assets"),
    type: z.enum(CCTV_TYPES),
    recorderId: optionalId,
    lastMaintenanceAt: optionalDate,
    notes: optionalText(2000),
  })
  .strict();

function checkCctv(
  d: { type: string; recorderId?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  // A recorder records; it is not itself recorded by another box.
  if ((d.type === "NVR" || d.type === "DVR") && d.recorderId) {
    ctx.addIssue({
      code: "custom",
      message: "A recorder cannot be attached to another recorder",
      path: ["recorderId"],
    });
  }
}

export const cctvSchema = cctvObject.superRefine(checkCctv);
export const updateCctvSchema = cctvObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkCctv);
export type CctvInput = z.infer<typeof cctvSchema>;

export const infrastructureIdSchema = z.object({ id: z.string().min(1) }).strict();
