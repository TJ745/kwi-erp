import { parseAmount, SALARY_PARTS, type SalaryPart } from "@/lib/increments";

/**
 * Bulk salary update from Excel. The template is pre-filled with every
 * employee and their current salary; the person edits the amounts and
 * uploads it back. Rows are matched on Employee ID. Name and Company are
 * there to read, not to change, and are ignored on upload.
 */

export const SALARY_SHEET_NAME = "Salaries";

export const SALARY_COLUMNS = [
  { key: "employeeNo", header: "Employee ID" },
  { key: "name", header: "Name" },
  { key: "company", header: "Company" },
  { key: "basic", header: "Basic Salary" },
  { key: "transport", header: "Transp. Allowance" },
  { key: "housing", header: "Housing Allowance" },
  { key: "other", header: "Mobile / Food Allowance" },
] as const;

export type SalaryColumnKey = (typeof SALARY_COLUMNS)[number]["key"];

export type SalaryRow = { rowNumber: number; cells: Record<SalaryColumnKey, string> };

/** Amounts as stored ("4200.00"), or null for "not recorded". */
export type SalaryValues = Record<SalaryPart, string | null>;

export type SalaryRowResult = {
  rowNumber: number;
  employeeNo: string;
  name: string;
  issues: string[];
  changed: boolean;
};

export type SalaryPreview = {
  rows: SalaryRowResult[];
  changedCount: number;
  unchangedCount: number;
  errorCount: number;
};

export type SalaryImportResponse =
  | { ok: true; mode: "preview"; preview: SalaryPreview }
  | { ok: true; mode: "commit"; updated: number }
  | { ok: false; error: string; preview?: SalaryPreview };

export const SALARY_MAX_ROWS = 2000;

/** What the validator knows about the database. */
export type SalaryReferences = {
  /** Upper-cased employee number → the employee, for those in scope. */
  employees: ReadonlyMap<string, { id: string; name: string; salary: SalaryValues }>;
};

export type ValidSalaryRow = { employeeId: string; values: SalaryValues; changed: boolean };

/** A cell to a stored amount: blank is null, otherwise 2 decimals. */
function toStored(raw: string): { value: string | null } | { error: true } {
  if (raw.trim() === "") return { value: null };
  const minor = parseAmount(raw);
  return minor === null ? { error: true } : { value: (minor / 100).toFixed(2) };
}

const same = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && Number(a) === Number(b));

export function validateSalaryRows(
  rows: readonly SalaryRow[],
  refs: SalaryReferences,
): { results: SalaryRowResult[]; valid: ValidSalaryRow[] } {
  const results: SalaryRowResult[] = [];
  const valid: ValidSalaryRow[] = [];

  const seen = new Map<string, number[]>();
  for (const row of rows) {
    const no = row.cells.employeeNo.trim().toUpperCase();
    if (no) seen.set(no, [...(seen.get(no) ?? []), row.rowNumber]);
  }

  for (const row of rows) {
    const issues: string[] = [];
    const no = row.cells.employeeNo.trim().toUpperCase();
    const employee = no ? refs.employees.get(no) : undefined;

    if (!no) issues.push("Employee ID is required");
    else if (!employee) issues.push(`Employee ${no} not found`);
    const dupes = (seen.get(no) ?? []).filter((r) => r !== row.rowNumber);
    if (no && dupes.length) issues.push(`${no} is repeated on row ${dupes.map(String).join(", ")}`);

    const values = {} as SalaryValues;
    for (const part of SALARY_PARTS) {
      const parsed = toStored(row.cells[part]);
      if ("error" in parsed) {
        const header = SALARY_COLUMNS.find((c) => c.key === part)?.header ?? part;
        issues.push(`${header}: "${row.cells[part]}" is not an amount`);
        values[part] = null;
      } else values[part] = parsed.value;
    }

    const changed =
      employee !== undefined && SALARY_PARTS.some((p) => !same(values[p], employee.salary[p]));

    results.push({
      rowNumber: row.rowNumber,
      employeeNo: no || "—",
      name: employee?.name ?? (row.cells.name.trim() || "—"),
      issues,
      changed: issues.length === 0 && changed,
    });
    if (issues.length === 0 && employee) valid.push({ employeeId: employee.id, values, changed });
  }

  return { results, valid };
}

export function summariseSalaryRows(results: readonly SalaryRowResult[]): SalaryPreview {
  const errorCount = results.filter((r) => r.issues.length > 0).length;
  const changedCount = results.filter((r) => r.changed).length;
  return {
    rows: [...results],
    changedCount,
    unchangedCount: results.length - errorCount - changedCount,
    errorCount,
  };
}
