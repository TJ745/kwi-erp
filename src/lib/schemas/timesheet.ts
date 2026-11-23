import { z } from "zod";
import { DAY_CODES, TIMESHEET_GROUPS, WEEKENDS } from "@/lib/timesheet";

/**
 * Timesheet files — one uploaded file per company per month.
 *
 * The timesheet itself is kept in Excel. The system records which company and
 * month a file covers and keeps the file; it does not read the hours.
 */

/** The file types a timesheet may be. */
export const TIMESHEET_EXTENSIONS = ["xlsx", "xls", "pdf"] as const;

/** `YYYY-MM`, as produced by a month picker. */
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const timesheetFileSchema = z
  .object({
    companyId: z.string().trim().min(1, "Select the company"),
    month: z.string().trim().regex(MONTH, "Select the month"),
    fileId: z.string().trim().min(1, "Upload the timesheet file"),
    notes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .strict();

export type TimesheetFileInput = z.infer<typeof timesheetFileSchema>;

export const timesheetFileIdSchema = z.object({ id: z.string().min(1) }).strict();

/** `2026-11` → 1 Nov 2026 00:00 UTC, the value stored for that month. */
export function monthStart(value: string): Date {
  const match = MONTH.exec(value);
  if (!match) throw new Error(`Not a month: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

/** 1 Nov 2026 → "November 2026". UTC, because that is how the month is stored. */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// --- Timesheets (the attendance grid) ---------------------------------------------

export const createTimesheetSchema = z
  .object({
    month: z.string().trim().regex(MONTH, "Select the month"),
    companyIds: z.array(z.string().min(1)).min(1, "Tick at least one company").max(20),
    group: z.enum(TIMESHEET_GROUPS),
    title: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .strict();

export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;

export const saveTimesheetSchema = z
  .object({
    id: z.string().min(1),
    rows: z
      .array(
        z
          .object({
            employeeId: z.string().min(1),
            weekend: z.enum(WEEKENDS),
            days: z.array(z.enum(DAY_CODES)).min(28).max(31),
            extra: z.array(z.number().min(0).max(1440).nullable()).min(28).max(31),
            /** Food allowance for the month, SAR. */
            foodAllowance: z.number().min(0).max(100000).nullable().default(null),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();

export type SaveTimesheetInput = z.infer<typeof saveTimesheetSchema>;

export const timesheetRowSchema = z
  .object({ id: z.string().min(1), employeeId: z.string().min(1) })
  .strict();

export const signedTimesheetSchema = z
  .object({ id: z.string().min(1), fileId: z.string().min(1, "Upload the signed copy") })
  .strict();
