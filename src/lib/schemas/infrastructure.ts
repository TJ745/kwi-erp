import { z } from "zod";

/** IT infrastructure — brief §24–§26. */

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

const optionalInt = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= max),
      `Enter a whole number up to ${String(max)}`,
    );

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

const optionalIp = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || isValidIp(v), "Enter a valid IP address");

/** Accepts the usual separators; stored uppercase and colon-delimited. */
export function normaliseMac(value: string): string | null {
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12) return null;
  return (hex.match(/.{2}/g) ?? []).join(":");
}

const optionalMac = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || normaliseMac(v) !== null, "Enter a valid MAC address")
  .transform((v) => (v === undefined ? undefined : (normaliseMac(v) ?? undefined)));

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const CCTV_TYPES = ["DOME", "BULLET", "PTZ", "NVR", "DVR"] as const;
/** Only a recorder can have cameras pointed at it. */
export const RECORDER_TYPES = ["NVR", "DVR"] as const;

// --- Servers -----------------------------------------------------------------

export const serverSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    name: z.string().trim().min(2, "Name is required").max(100),
    ipAddress: optionalIp,
    os: optionalText(100),
    role: optionalText(100),
    location: optionalText(150),
    cpuSpec: optionalText(150),
    ramGb: optionalInt(4096),
    storageGb: optionalInt(1_000_000),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
    notes: optionalText(2000),
  })
  .strict();

export const updateServerSchema = serverSchema.extend({ id: z.string().min(1) });
export type ServerInput = z.infer<typeof serverSchema>;

// --- Network devices ---------------------------------------------------------

export const networkDeviceSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    name: z.string().trim().min(2, "Name is required").max(100),
    type: z.string().trim().min(2, "Type is required").max(60),
    model: optionalText(100),
    ipAddress: optionalIp,
    macAddress: optionalMac,
    location: optionalText(150),
    vlan: optionalText(40),
    portCount: optionalInt(1000),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
    notes: optionalText(2000),
  })
  .strict();

export const updateNetworkDeviceSchema = networkDeviceSchema.extend({
  id: z.string().min(1),
});
export type NetworkDeviceInput = z.infer<typeof networkDeviceSchema>;

// --- IP addresses ------------------------------------------------------------

export const ipAddressSchema = z
  .object({
    address: z
      .string()
      .trim()
      .min(1, "Address is required")
      .refine(isValidIp, "Enter a valid IP address"),
    subnet: optionalText(60),
    assignedTo: optionalText(150),
    deviceId: optionalId,
    isStatic: z.boolean().default(true),
    notes: optionalText(500),
  })
  .strict();

export const updateIpAddressSchema = ipAddressSchema.extend({ id: z.string().min(1) });
export type IpAddressInput = z.infer<typeof ipAddressSchema>;

// --- IP phones ---------------------------------------------------------------

export const ipPhoneSchema = z
  .object({
    extension: z
      .string()
      .trim()
      .min(2, "Extension is required")
      .max(12)
      .regex(/^[0-9]+$/, "Extensions are digits only"),
    employeeId: optionalId,
    deviceModel: optionalText(100),
    macAddress: optionalMac,
    location: optionalText(150),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
  })
  .strict();

export const updateIpPhoneSchema = ipPhoneSchema.extend({ id: z.string().min(1) });
export type IpPhoneInput = z.infer<typeof ipPhoneSchema>;

// --- CCTV --------------------------------------------------------------------

const cctvObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    name: z.string().trim().min(2, "Name is required").max(100),
    type: z.enum(CCTV_TYPES),
    location: z.string().trim().min(2, "Location is required").max(150),
    ipAddress: optionalIp,
    recorderId: optionalId,
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
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

// --- Software licences -------------------------------------------------------

/**
 * No licence-key field. Keys live in the vault and are referenced by
 * `licenseKeyCredentialId` — see the schema comment on SoftwareLicense and
 * docs/SECURITY.md §5.
 */
const licenceObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    name: z.string().trim().min(2, "Name is required").max(150),
    vendor: optionalText(100),
    licenseKeyCredentialId: optionalId,
    seats: z
      .string()
      .default("1")
      .transform((v) => Number(v))
      .refine(
        (v) => Number.isInteger(v) && v >= 1 && v <= 100_000,
        "Seats must be a whole number of at least 1",
      ),
    seatsUsed: z
      .string()
      .default("0")
      .transform((v) => Number(v))
      .refine(
        (v) => Number.isInteger(v) && v >= 0 && v <= 100_000,
        "Seats used must be a whole number",
      ),
    purchaseDate: optionalDate,
    expiryDate: optionalDate,
    notes: optionalText(2000),
  })
  .strict();

function checkLicence(
  d: { seats: number; seatsUsed: number },
  ctx: z.RefinementCtx,
): void {
  // Over-deployment is a compliance problem, not a rounding error.
  if (d.seatsUsed > d.seats) {
    ctx.addIssue({
      code: "custom",
      message: "Seats used cannot exceed the seats owned",
      path: ["seatsUsed"],
    });
  }
}

export const licenceSchema = licenceObject.superRefine(checkLicence);
export const updateLicenceSchema = licenceObject
  .extend({ id: z.string().min(1) })
  .superRefine(checkLicence);
export type LicenceInput = z.infer<typeof licenceSchema>;

// --- Active Directory --------------------------------------------------------

/** Metadata only — the schema comment says so, and no password field exists. */
export const adRecordSchema = z
  .object({
    samAccountName: z
      .string()
      .trim()
      .min(2, "Account name is required")
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dot, underscore or hyphen"),
    employeeId: optionalId,
    ou: optionalText(200),
    groups: optionalText(1000),
    enabled: z.boolean().default(true),
    notes: optionalText(1000),
  })
  .strict();

export const updateAdRecordSchema = adRecordSchema.extend({ id: z.string().min(1) });
export type AdRecordInput = z.infer<typeof adRecordSchema>;

export const infrastructureIdSchema = z.object({ id: z.string().min(1) }).strict();
