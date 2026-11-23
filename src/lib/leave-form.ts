import { z } from "zod";

/**
 * The company's Leave Request form (طلب اجازه): the tick boxes for the kind of
 * leave, and the parts of the form that are only ever printed.
 */

/** The five "Leave Requested" boxes, and the leave types that tick each. */
export const LEAVE_BOXES = [
  {
    key: "CASH",
    en: "Request to cash without exit",
    ar: "صرف بدل اجازة دون المغادرة",
    types: ["ENCASHMENT"],
  },
  { key: "UNPAID", en: "Unpaid", ar: "بدون راتب", types: ["UNPAID"] },
  { key: "SICK", en: "Sick", ar: "مرضية", types: ["SICK"] },
  { key: "EMERGENCY", en: "Emergency", ar: "طارئة", types: ["EMERGENCY"] },
  { key: "CONTRACTUAL", en: "Contractual", ar: "تعاقدية", types: ["ANNUAL"] },
] as const;

export const VISA_TYPES = ["SINGLE", "MULTIPLE", "EXIT"] as const;
export const VISA_ACCOUNTS = ["EMPLOYEE", "COMPANY", "OTHER"] as const;

const text = (max: number) => z.string().trim().max(max).default("");
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).default("");

export const leaveFormSchema = z
  .object({
    country: text(80),
    destination: text(80),
    homeAddress: text(300),
    poBox: text(60),
    cityCountry: text(120),
    telHome: text(40),
    telRelative: text(80),
    email: text(120),
    leaveDueEvery: text(60),
    /** dd/mm/yyyy as printed, or blank. */
    lastArrival: text(20),
    ticketsSelf: text(20),
    ticketsWife: text(20),
    ticketsChildren: text(20),
    visaType: choice(VISA_TYPES),
    visaPeriod: text(40),
    visaAccount: choice(VISA_ACCOUNTS),
    specialRemarks: text(1000),
  })
  .strict();

export type LeaveForm = z.infer<typeof leaveFormSchema>;

export function readLeaveForm(value: unknown): LeaveForm {
  return leaveFormSchema.safeParse(value ?? {}).data ?? leaveFormSchema.parse({});
}

/** "dd/mm/yyyy" from a UTC-midnight date. */
export function dmy(d: Date | null | undefined): string {
  if (!d) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear())}`;
}
