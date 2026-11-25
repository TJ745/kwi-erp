import { employeeSchema, type EmployeeInput } from "@/lib/schemas/employee";

/**
 * Bulk employee import — the spreadsheet contract.
 *
 * Shared between the template writer, the parser, the validator and the
 * preview screen so there is exactly one definition of what a column is
 * called and what goes in it. A column added here appears in the downloaded
 * template, is read back from the upload, and is checked, without touching
 * anything else.
 *
 * Deliberately employees only: Iqama and passport details are separate
 * records with their own rules, and bolting them onto this sheet would make
 * every error on one of them block the person's whole row.
 */

export const IMPORT_COLUMNS = [
  { key: "employeeNo", header: "Employee ID", required: true, example: "KWI-001", hint: "Your own staff number. Must be unique." },
  { key: "firstName", header: "First name", required: true, example: "Ahmed" },
  { key: "middleName", header: "Middle name", required: false, example: "Mohammed", hint: "Father's name, as on the Iqama." },
  { key: "lastName", header: "Last name", required: true, example: "Ali", hint: "Grandfather's name." },
  { key: "familyName", header: "Family name", required: false, example: "Al-Qahtani" },
  { key: "fullNameAr", header: "Full name (Arabic)", required: false, example: "أحمد محمد علي القحطاني" },
  { key: "gender", header: "Gender", required: true, example: "Male", hint: "Male or Female." },
  { key: "dateOfBirth", header: "Date of birth", required: false, example: "1990-05-14", hint: "YYYY-MM-DD." },
  { key: "nationality", header: "Nationality", required: true, example: "SA", hint: "Two-letter country code: SA, PK, IN, EG…" },
  { key: "maritalStatus", header: "Marital status", required: false, example: "Married", hint: "Single, Married, Divorced or Widowed." },
  { key: "companyCode", header: "Company", required: true, example: "KWI", hint: "Company code — see the Reference sheet." },
  { key: "department", header: "Department", required: false, example: "Finance", hint: "Exact department name — see the Reference sheet." },
  { key: "position", header: "Position", required: false, example: "Accountant", hint: "Exact position title — see the Reference sheet." },
  { key: "managerNo", header: "Manager employee ID", required: false, example: "KWI-000", hint: "The manager's Employee ID — an existing employee or another row in this file." },
  { key: "status", header: "Status", required: false, example: "Active", hint: "New hire, Active, On leave, Resigned, Terminated, Exited or Inactive. Blank = Active." },
  { key: "employmentType", header: "Employment type", required: false, example: "Full time", hint: "Full time, Part time, Contract, Temporary or Intern. Blank = Full time." },
  { key: "joiningDate", header: "Joining date", required: true, example: "2021-03-01", hint: "YYYY-MM-DD." },
  { key: "lastWorkingDate", header: "Last working date", required: false, example: "", hint: "YYYY-MM-DD. Required when status is Resigned, Terminated or Exited." },
  { key: "mobile", header: "Mobile", required: false, example: "0501234567" },
  { key: "workEmail", header: "Work email", required: false, example: "ahmed@example.com" },
  { key: "personalEmail", header: "Personal email", required: false, example: "" },
  { key: "saudiAddressEn", header: "Address in KSA", required: false, example: "Al Olaya, Riyadh" },
  { key: "saudiAddressAr", header: "Address in KSA (Arabic)", required: false, example: "" },
  { key: "homeAddressEn", header: "Home country address", required: false, example: "" },
  { key: "homeAddressAr", header: "Home country address (Arabic)", required: false, example: "" },
  { key: "homePhone", header: "Home country phone", required: false, example: "" },
  { key: "notes", header: "Notes", required: false, example: "" },
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

/** One spreadsheet row as read: every cell already a trimmed string. */
export type ImportRow = {
  /** The spreadsheet's own row number, so an error can be found in Excel. */
  rowNumber: number;
  cells: Record<ImportColumnKey, string>;
};

export type ImportIssue = { column: ImportColumnKey | null; message: string };

export type ImportRowResult = {
  rowNumber: number;
  employeeNo: string;
  fullName: string;
  companyCode: string;
  issues: ImportIssue[];
};

export type ImportPreview = {
  rows: ImportRowResult[];
  readyCount: number;
  errorCount: number;
};

/** What `POST /api/employees/import` answers, in either mode. */
export type ImportResponse =
  | { ok: true; mode: "preview"; preview: ImportPreview }
  | { ok: true; mode: "commit"; created: number }
  | { ok: false; error: string; preview?: ImportPreview };

/** The upper bound on one file. Above this, split the sheet. */
export const IMPORT_MAX_ROWS = 1000;

export const IMPORT_SHEET_NAME = "Employees";
export const IMPORT_REFERENCE_SHEET_NAME = "Reference";

/**
 * Human labels accepted for each enum column, matched case-insensitively and
 * ignoring spaces, hyphens and underscores — so "Full time", "FULL_TIME" and
 * "full-time" are all the same value. The template's dropdowns offer the
 * first label of each.
 */
export const ENUM_LABELS = {
  gender: { MALE: ["Male", "M"], FEMALE: ["Female", "F"] },
  maritalStatus: {
    SINGLE: ["Single"],
    MARRIED: ["Married"],
    DIVORCED: ["Divorced"],
    WIDOWED: ["Widowed"],
  },
  status: {
    NEW_HIRE: ["New hire", "New"],
    ACTIVE: ["Active"],
    ON_LEAVE: ["On leave"],
    RESIGNED: ["Resigned"],
    TERMINATED: ["Terminated"],
    EXITED: ["Exited"],
    INACTIVE: ["Inactive"],
  },
  employmentType: {
    FULL_TIME: ["Full time"],
    PART_TIME: ["Part time"],
    CONTRACT: ["Contract"],
    TEMPORARY: ["Temporary"],
    INTERN: ["Intern"],
  },
} as const satisfies Partial<Record<ImportColumnKey, Record<string, readonly string[]>>>;

type EnumColumn = keyof typeof ENUM_LABELS;

const fold = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

/** Maps a typed label to the enum value, or null when nothing matches. */
export function enumFromLabel(column: EnumColumn, raw: string): string | null {
  const wanted = fold(raw);
  for (const [value, labels] of Object.entries(ENUM_LABELS[column])) {
    if (fold(value) === wanted) return value;
    if ((labels as readonly string[]).some((l) => fold(l) === wanted)) return value;
  }
  return null;
}

/** Dropdown choices for the template: the first label of every value. */
export function enumChoices(column: EnumColumn): string[] {
  const table: Record<string, readonly string[]> = ENUM_LABELS[column];
  return Object.values(table).map((labels) => labels[0] ?? "");
}

/**
 * Dates: ISO is the documented form; DD/MM/YYYY is accepted because it is
 * what people in the Gulf actually type. Anything else is refused rather
 * than guessed — `new Date("01/02/2026")` would silently read as 2 January.
 */
export function normaliseDate(raw: string): { iso: string } | { error: string } | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s };
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d = "", m = "", y = ""] = dmy;
    return { iso: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  return { error: "Use YYYY-MM-DD" };
}

/** What the validator needs to know about the database, fetched once. */
export type ImportReferences = {
  companies: { id: string; code: string }[];
  departments: { id: string; name: string; companyId: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  /** Employee numbers already in use, including archived records. */
  existingEmployeeNos: ReadonlySet<string>;
  existingWorkEmails: ReadonlySet<string>;
  /** Existing employees who may be named as a manager. */
  managers: { id: string; employeeNo: string; companyId: string }[];
};

/** A row that passed every check, ready to be written. */
export type ValidatedRow = {
  rowNumber: number;
  input: EmployeeInput;
  /** Resolved to an existing employee id, or deferred to a row in this file. */
  manager: { existingId: string } | { rowEmployeeNo: string } | null;
};

const HEADER_OF = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.header])) as Record<
  ImportColumnKey,
  string
>;

export const columnHeader = (key: ImportColumnKey): string => HEADER_OF[key];

/**
 * Checks every row against the same rules as the Add Employee form, plus the
 * rules that only make sense across rows. Pure: takes the rows and a snapshot
 * of the database, returns a verdict per row. Nothing is written here.
 */
export function validateImportRows(
  rows: readonly ImportRow[],
  refs: ImportReferences,
): { results: ImportRowResult[]; valid: ValidatedRow[] } {
  const results: ImportRowResult[] = [];
  const valid: ValidatedRow[] = [];

  const companyByCode = new Map(refs.companies.map((c) => [c.code.toUpperCase(), c]));
  const managerByNo = new Map(refs.managers.map((m) => [m.employeeNo.toUpperCase(), m]));

  // First pass: which numbers does this file itself define, and where. Needed
  // before validating any row, since a manager may appear later in the file.
  const seenNo = new Map<string, number[]>();
  for (const row of rows) {
    const no = row.cells.employeeNo.trim().toUpperCase();
    if (!no) continue;
    seenNo.set(no, [...(seenNo.get(no) ?? []), row.rowNumber]);
  }
  const seenEmail = new Map<string, number[]>();
  for (const row of rows) {
    const email = row.cells.workEmail.trim().toLowerCase();
    if (!email) continue;
    seenEmail.set(email, [...(seenEmail.get(email) ?? []), row.rowNumber]);
  }
  const companyOfRow = new Map<string, string | null>();
  for (const row of rows) {
    const no = row.cells.employeeNo.trim().toUpperCase();
    const company = companyByCode.get(row.cells.companyCode.trim().toUpperCase());
    if (no) companyOfRow.set(no, company?.id ?? null);
  }

  for (const row of rows) {
    const issues: ImportIssue[] = [];
    const c = row.cells;
    const issue = (column: ImportColumnKey | null, message: string) => {
      issues.push({ column, message });
    };

    const employeeNo = c.employeeNo.trim().toUpperCase();
    const company = companyByCode.get(c.companyCode.trim().toUpperCase());
    if (!c.companyCode.trim()) issue("companyCode", "Company is required");
    else if (!company) issue("companyCode", `Company "${c.companyCode.trim()}" not found`);

    if (employeeNo) {
      if (refs.existingEmployeeNos.has(employeeNo)) {
        issue("employeeNo", `${employeeNo} already exists in the system`);
      }
      const dupes = (seenNo.get(employeeNo) ?? []).filter((r) => r !== row.rowNumber);
      if (dupes.length) {
        issue("employeeNo", `${employeeNo} is repeated on row ${dupes.map(String).join(", ")}`);
      }
    }

    const email = c.workEmail.trim().toLowerCase();
    if (email) {
      if (refs.existingWorkEmails.has(email)) issue("workEmail", `${email} is already in use`);
      const dupes = (seenEmail.get(email) ?? []).filter((r) => r !== row.rowNumber);
      if (dupes.length) issue("workEmail", `${email} is repeated on row ${dupes.map(String).join(", ")}`);
    }

    // Department and position by name, within the row's company. A blank is
    // "unassigned", which the form allows too.
    let departmentId: string | undefined;
    if (c.department.trim() && company) {
      const match = refs.departments.find(
        (d) => d.companyId === company.id && d.name.toLowerCase() === c.department.trim().toLowerCase(),
      );
      if (!match) issue("department", `Department "${c.department.trim()}" not found in ${company.code}`);
      else departmentId = match.id;
    }
    let positionId: string | undefined;
    if (c.position.trim() && company) {
      const match = refs.positions.find(
        (p) =>
          (p.companyId === null || p.companyId === company.id) &&
          p.title.toLowerCase() === c.position.trim().toLowerCase(),
      );
      if (!match) issue("position", `Position "${c.position.trim()}" not found in ${company.code}`);
      else positionId = match.id;
    }

    // Manager: an existing employee, or another row in this file. Either way
    // the same company, and never themselves.
    let manager: ValidatedRow["manager"] = null;
    const managerNo = c.managerNo.trim().toUpperCase();
    if (managerNo && company) {
      if (managerNo === employeeNo) {
        issue("managerNo", "An employee cannot report to themselves");
      } else {
        const existing = managerByNo.get(managerNo);
        if (existing) {
          if (existing.companyId !== company.id) {
            issue("managerNo", `${managerNo} belongs to a different company`);
          } else manager = { existingId: existing.id };
        } else if (seenNo.has(managerNo)) {
          if (companyOfRow.get(managerNo) !== company.id) {
            issue("managerNo", `${managerNo} (in this file) belongs to a different company`);
          } else manager = { rowEmployeeNo: managerNo };
        } else {
          issue("managerNo", `Manager ${managerNo} not found — not an existing employee and not in this file`);
        }
      }
    }

    // Enum columns: a readable label in, the stored value out.
    const enums: Partial<Record<EnumColumn, string>> = {};
    for (const column of ["gender", "maritalStatus", "status", "employmentType"] as const) {
      const raw = c[column].trim();
      if (!raw) continue;
      const value = enumFromLabel(column, raw);
      if (value === null) {
        issue(column, `"${raw}" is not one of: ${enumChoices(column).join(", ")}`);
      } else enums[column] = value;
    }

    const dates: Partial<Record<"dateOfBirth" | "joiningDate" | "lastWorkingDate", string>> = {};
    for (const column of ["dateOfBirth", "joiningDate", "lastWorkingDate"] as const) {
      const parsed = normaliseDate(c[column]);
      if (parsed === null) continue;
      if ("error" in parsed) issue(column, parsed.error);
      else dates[column] = parsed.iso;
    }

    // Everything else is the form's own schema, so a rule added there applies
    // here without a second copy. Only the rows whose references resolved are
    // worth parsing; the rest already have their reason.
    const candidate = {
      employeeNo: c.employeeNo,
      companyId: company?.id ?? "",
      departmentId,
      positionId,
      managerId: undefined,
      firstName: c.firstName,
      middleName: c.middleName,
      lastName: c.lastName,
      familyName: c.familyName,
      fullNameAr: c.fullNameAr,
      gender: enums.gender ?? "",
      dateOfBirth: dates.dateOfBirth ?? "",
      nationality: c.nationality,
      maritalStatus: enums.maritalStatus ?? "",
      status: enums.status ?? "ACTIVE",
      employmentType: enums.employmentType ?? "FULL_TIME",
      joiningDate: dates.joiningDate ?? "",
      lastWorkingDate: dates.lastWorkingDate ?? "",
      mobile: c.mobile,
      workEmail: c.workEmail,
      personalEmail: c.personalEmail,
      notes: c.notes,
      saudiAddressEn: c.saudiAddressEn,
      saudiAddressAr: c.saudiAddressAr,
      homeAddressEn: c.homeAddressEn,
      homeAddressAr: c.homeAddressAr,
      homePhone: c.homePhone,
    };
    const parsed = employeeSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        const key = problem.path[0];
        // A missing company was reported above, by code rather than by id.
        if (key === "companyId") continue;
        const column = typeof key === "string" && key in HEADER_OF ? (key as ImportColumnKey) : null;
        // Already reported above in a more specific form.
        if (column && issues.some((i) => i.column === column)) continue;
        issue(column, problem.message);
      }
    }

    results.push({
      rowNumber: row.rowNumber,
      employeeNo: employeeNo || "—",
      fullName: `${c.firstName.trim()} ${c.lastName.trim()}`.trim() || "—",
      companyCode: company?.code ?? c.companyCode.trim(),
      issues,
    });

    if (issues.length === 0 && parsed.success) {
      valid.push({ rowNumber: row.rowNumber, input: parsed.data, manager });
    }
  }

  return { results, valid };
}
