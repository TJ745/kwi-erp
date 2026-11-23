/**
 * The company's monthly TIME SHEET, as pure rules: the period (16th of the
 * previous month to the 15th), the code each day starts with, and the totals
 * printed at the end of each row.
 */

export const DAY_CODES = ["P", "A", "V", "S", "L", "FRI", "SAT", ""] as const;
export type DayCode = (typeof DAY_CODES)[number];
export const WEEKENDS = ["FRI", "FRI_SAT"] as const;
export type Weekend = (typeof WEEKENDS)[number];
export const TIMESHEET_GROUPS = ["NON_SAUDI", "SAUDI", "ALL"] as const;
export type TimesheetGroupValue = (typeof TIMESHEET_GROUPS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-11` → 16 Oct 2026 … 15 Nov 2026, as UTC midnights. */
export function periodDays(month: string): Date[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = Date.UTC(y, m - 2, 16);
  const end = Date.UTC(y, m - 1, 15);
  const days: Date[] = [];
  for (let t = start; t <= end; t += DAY_MS) days.push(new Date(t));
  return days;
}

/** "Nov-26", as the sheet's heading prints the month. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const name = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return `${name}-${String(y % 100).padStart(2, "0")}`;
}

/** `2026-11-01` (a stored month) → `2026-11`. */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** The weekly day off a date falls on for this employee, if any. */
export function weekendCode(date: Date, weekend: Weekend): DayCode | null {
  const dow = date.getUTCDay(); // 5 = Friday, 6 = Saturday
  if (dow === 5) return "FRI";
  if (dow === 6 && weekend === "FRI_SAT") return "SAT";
  return null;
}

/** Leave as it shows on the sheet. */
export function leaveCode(leaveTypeKey: string): DayCode {
  if (leaveTypeKey === "SICK") return "S";
  if (leaveTypeKey === "UNPAID") return "L";
  return "V";
}

/**
 * The code each day of the period starts with: blank outside employment, the
 * weekly day off, any recorded leave (which covers days off too), else P.
 */
export function initialDays(input: {
  days: Date[];
  weekend: Weekend;
  joiningDate: Date;
  lastWorkingDate: Date | null;
  leave: { start: Date; end: Date; typeKey: string }[];
}): DayCode[] {
  return input.days.map((d) => {
    if (d < input.joiningDate) return "";
    if (input.lastWorkingDate && d > input.lastWorkingDate) return "";
    const onLeave = input.leave.find((l) => d >= l.start && d <= l.end);
    if (onLeave) return leaveCode(onLeave.typeKey);
    return weekendCode(d, input.weekend) ?? "P";
  });
}

export type RowTotals = {
  working: number;
  absent: number;
  vacation: number;
  /** Days off and sick days — paid days not worked. */
  fridaysHolidays: number;
  /** The days paid for: worked plus paid days off. */
  monthDays: number;
  /** Overtime hours, or delay minutes on a Saudi sheet. */
  extra: number;
};

/**
 * The figures at the end of each row, as the company's sheets add them up:
 * L (leave without pay) counts as absent, sick as a paid day off.
 */
export function rowTotals(codes: readonly string[], extra: readonly (number | null)[]): RowTotals {
  const count = (...c: string[]) => codes.filter((x) => c.includes(x)).length;
  const working = count("P");
  const fridaysHolidays = count("FRI", "SAT", "S");
  return {
    working,
    absent: count("A", "L"),
    vacation: count("V"),
    fridaysHolidays,
    monthDays: working + fridaysHolidays,
    extra: extra.reduce<number>((n, v) => n + (v ?? 0), 0),
  };
}

/** "1 Hrs 25 Mins" from minutes, as the Saudi sheet prints delay. */
export function delayLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60))} Hrs ${String(minutes % 60)} Mins`;
}

/** "28th October 2026", for a leaver's row. */
export function longOrdinal(d: Date): string {
  const n = d.getUTCDate();
  const suffix =
    n % 10 === 1 && n !== 11
      ? "st"
      : n % 10 === 2 && n !== 12
        ? "nd"
        : n % 10 === 3 && n !== 13
          ? "rd"
          : "th";
  const rest = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return `${String(n).padStart(2, "0")}${suffix} ${rest}`;
}

/** What clicking a day does with each "mark with" choice. */
export type Brush = "TOGGLE" | "V" | "S" | "L" | "OFF";

export function applyBrush(code: DayCode, brush: Brush, off: DayCode | null): DayCode {
  if (code === "") return ""; // outside employment
  switch (brush) {
    case "TOGGLE":
      if (code === "P") return "A";
      if (code === "FRI" || code === "SAT") return code;
      return "P";
    case "OFF":
      return off ?? code;
    default:
      return code === brush ? (off ?? "P") : brush;
  }
}

export type RowSegment =
  { kind: "day"; index: number } | { kind: "gap"; start: number; length: number; before: boolean };

/**
 * A row's cells, with each run of days outside employment merged into one
 * cell — where the sheet prints "Last Working Day: …" or the joining date.
 */
export function rowSegments(codes: readonly string[]): RowSegment[] {
  const out: RowSegment[] = [];
  const firstWorked = codes.findIndex((c) => c !== "");
  for (let i = 0; i < codes.length;) {
    if (codes[i] !== "") {
      out.push({ kind: "day", index: i });
      i += 1;
      continue;
    }
    let j = i;
    while (j < codes.length && codes[j] === "") j += 1;
    out.push({
      kind: "gap",
      start: i,
      length: j - i,
      before: firstWorked === -1 || i < firstWorked,
    });
    i = j;
  }
  return out;
}
