/**
 * An employee's monthly pay, as kept on their record: basic salary and five
 * allowances. Increment lists keep their own four columns (see increments.ts),
 * where mobile, food and other allowances are one column.
 */

export const PAY_PARTS = ["basic", "housing", "transport", "mobile", "food", "other"] as const;
export type PayPart = (typeof PAY_PARTS)[number];

export const PAY_PART_LABELS: Record<PayPart, string> = {
  basic: "Basic Salary",
  housing: "Housing Allowance",
  transport: "Transportation Allowance",
  mobile: "Mobile Allowance",
  food: "Food Allowance",
  other: "Other Allowance",
};

/** The Employee column each part is stored in. */
export const PAY_FIELDS = {
  basic: "basicSalary",
  housing: "housingAllowance",
  transport: "transportAllowance",
  mobile: "mobileAllowance",
  food: "foodAllowance",
  other: "otherAllowance",
} as const satisfies Record<PayPart, string>;

/** Amounts as stored ("4200.00"), or null when not recorded. */
export type Pay = Record<PayPart, string | null>;

const minor = (v: string | null | undefined) => {
  const n = Number((v ?? "").replace(/,/g, "").trim() || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** The sum of the given amounts, as a 2-decimal string. */
export function sumAmounts(values: readonly (string | null | undefined)[]): string {
  return (values.reduce((s, v) => s + minor(v), 0) / 100).toFixed(2);
}

/** Total monthly pay. */
export function payTotal(pay: Pay): string {
  return sumAmounts(PAY_PARTS.map((p) => pay[p]));
}

/** Reads the pay parts off an employee row (Prisma Decimals or nulls). */
export function payOf(row: Record<(typeof PAY_FIELDS)[PayPart], { toString(): string } | null>): Pay {
  return Object.fromEntries(
    PAY_PARTS.map((p) => [p, row[PAY_FIELDS[p]]?.toString() ?? null]),
  ) as Pay;
}

/** A Prisma select for every pay column. */
export const PAY_SELECT = {
  basicSalary: true,
  housingAllowance: true,
  transportAllowance: true,
  mobileAllowance: true,
  foodAllowance: true,
  otherAllowance: true,
} as const;
