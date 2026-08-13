/**
 * Timesheet arithmetic and rules — brief §18.
 *
 * Hours are stored per employee per day (the database enforces one row per
 * pair). Everything a period summary shows — totals, absences, delayed hours —
 * is derived from those rows rather than stored, so a corrected day changes
 * every figure that depends on it without a rebuild step.
 */

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type TimesheetDay = {
  normalHours: string;
  overtimeHours: string;
  delayedHours: string;
  absent: boolean;
  status: ApprovalStatus;
};

/** Hours are quarter-hour granular in practice; hundredths cover that exactly. */
function toHundredths(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

const fromHundredths = (n: number) => n / 100;

export type TimesheetSummary = {
  /** Days with a row, whatever their status. */
  daysRecorded: number;
  daysAbsent: number;
  /** Approved hours only — what payroll would act on. */
  normalHours: number;
  overtimeHours: number;
  delayedHours: number;
  /** Hours sitting in rows nobody has approved yet. */
  pendingHours: number;
};

export function summarise(days: readonly TimesheetDay[]): TimesheetSummary {
  let normal = 0;
  let overtime = 0;
  let delayed = 0;
  let pending = 0;
  let absent = 0;

  for (const day of days) {
    if (day.absent) absent += 1;

    const dayHours = toHundredths(day.normalHours) + toHundredths(day.overtimeHours);

    if (day.status === "APPROVED") {
      normal += toHundredths(day.normalHours);
      overtime += toHundredths(day.overtimeHours);
      delayed += toHundredths(day.delayedHours);
      continue;
    }

    // Rejected and cancelled days are history; only pending work is still a
    // claim on payroll.
    if (day.status === "PENDING") pending += dayHours;
  }

  return {
    daysRecorded: days.length,
    daysAbsent: absent,
    normalHours: fromHundredths(normal),
    overtimeHours: fromHundredths(overtime),
    delayedHours: fromHundredths(delayed),
    pendingHours: fromHundredths(pending),
  };
}

export type HoursProblem = { field: "normalHours" | "overtimeHours" | "delayedHours"; message: string };

/**
 * Validates one day's hours.
 *
 * Returns every problem rather than the first, so a form can mark all the
 * offending fields at once instead of making the user resubmit to find the
 * next one.
 */
export function validateHours(input: {
  normalHours: string;
  overtimeHours: string;
  delayedHours: string;
  absent: boolean;
}): HoursProblem[] {
  const problems: HoursProblem[] = [];

  const normal = toHundredths(input.normalHours);
  const overtime = toHundredths(input.overtimeHours);
  const delayed = toHundredths(input.delayedHours);

  for (const [field, value] of [
    ["normalHours", normal],
    ["overtimeHours", overtime],
    ["delayedHours", delayed],
  ] as const) {
    if (value < 0) {
      problems.push({ field, message: "Hours cannot be negative" });
    }
  }

  // A day is 24 hours. Anything more is a typo — usually a date in the hours
  // box — and it would silently inflate an overtime payment.
  if (normal + overtime > 2400) {
    problems.push({
      field: "overtimeHours",
      message: "Normal and overtime hours cannot exceed 24 in a day",
    });
  }

  if (delayed > 2400) {
    problems.push({ field: "delayedHours", message: "Delayed hours cannot exceed 24" });
  }

  // Absence and hours worked are contradictory claims about the same day.
  if (input.absent && normal + overtime > 0) {
    problems.push({
      field: "normalHours",
      message: "An absent day cannot also have hours worked",
    });
  }

  return problems;
}

/** Every date in an inclusive range, as yyyy-mm-dd. */
export function datesInRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

  // Bounded so a hostile or mistyped range cannot spin: a timesheet period is
  // a month, and 366 days is already more than any of them.
  while (cursor.getTime() <= end && out.length < 366) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}
