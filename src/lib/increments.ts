/**
 * Salary breakdowns for increment lists: four parts — basic, transport,
 * housing, mobile/food — and the arithmetic on them.
 *
 * Done in integer halalas so 0.1 + 0.2 never drifts. The increment is never
 * stored: it is always the new total minus the current total, so the figure
 * in the "Increment" column cannot disagree with the columns beside it.
 */

export const SALARY_PARTS = ["basic", "transport", "housing", "other"] as const;
export type SalaryPart = (typeof SALARY_PARTS)[number];

export const SALARY_PART_LABELS: Record<SalaryPart, string> = {
  basic: "Basic Salary",
  transport: "Transp. Allowance",
  housing: "Housing Allowance",
  other: "Mobile / Food Allowance",
};

/** Amounts as decimal strings, e.g. "4200.00". */
export type Breakdown = Record<SalaryPart, string>;

export const ZERO_BREAKDOWN: Breakdown = { basic: "0", transport: "0", housing: "0", other: "0" };

/** A typed amount: digits with up to two decimals, commas allowed. Blank is 0. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/,/g, "").trim();
  if (s === "") return 0;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Internal values may be negative (a decrease); typed input never is. */
const toMinor = (v: string): number => {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const fromMinor = (m: number): string => (m / 100).toFixed(2);

export function total(b: Breakdown): string {
  return fromMinor(SALARY_PARTS.reduce((sum, p) => sum + toMinor(b[p]), 0));
}

/** New total minus current total. */
export function incrementOf(current: Breakdown, next: Breakdown): string {
  return fromMinor(toMinor(total(next)) - toMinor(total(current)));
}

/**
 * Typing an increment amount: it goes on the basic salary, the allowances stay
 * as they are, which is how the company's sheet treats it. Returns null when
 * the amount is not a number.
 */
export function applyIncrement(
  current: Breakdown,
  next: Breakdown,
  amount: string,
): Breakdown | null {
  const inc = parseAmount(amount);
  if (inc === null) return null;
  const allowances = toMinor(next.transport) + toMinor(next.housing) + toMinor(next.other);
  const basic = toMinor(total(current)) + inc - allowances;
  return { ...next, basic: fromMinor(basic) };
}

/** Column totals for the "Total Amount SR" row. */
export function sumBreakdowns(rows: readonly Breakdown[]): Breakdown {
  const out = { ...ZERO_BREAKDOWN };
  for (const part of SALARY_PARTS) {
    out[part] = fromMinor(rows.reduce((sum, r) => sum + toMinor(r[part]), 0));
  }
  return out;
}

/** "4,200" for whole amounts, "4,200.50" otherwise; zero prints as a dash. */
export function formatAmount(value: string, { dashForZero = true } = {}): string {
  const minor = toMinor(value);
  if (minor === 0 && dashForZero) return "-";
  const whole = minor % 100 === 0;
  return (minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
