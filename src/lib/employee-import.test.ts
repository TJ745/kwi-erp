import { describe, expect, it } from "vitest";
import {
  IMPORT_COLUMNS,
  enumFromLabel,
  normaliseDate,
  validateImportRows,
  type ImportColumnKey,
  type ImportReferences,
  type ImportRow,
} from "./employee-import";

const refs: ImportReferences = {
  companies: [
    { id: "kwi", code: "KWI" },
    { id: "icc", code: "ICC" },
  ],
  departments: [
    { id: "fin", name: "Finance", companyId: "kwi" },
    { id: "ops", name: "Operations", companyId: "icc" },
  ],
  positions: [
    { id: "acc", title: "Accountant", companyId: "kwi" },
    { id: "drv", title: "Driver", companyId: null },
  ],
  existingEmployeeNos: new Set(["KWI-001"]),
  existingWorkEmails: new Set(["taken@example.com"]),
  managers: [{ id: "m1", employeeNo: "KWI-001", companyId: "kwi" }],
};

const blank = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, ""])) as Record<
  ImportColumnKey,
  string
>;

function row(rowNumber: number, cells: Partial<Record<ImportColumnKey, string>>): ImportRow {
  return {
    rowNumber,
    cells: {
      ...blank,
      firstName: "Ahmed",
      lastName: "Ali",
      gender: "Male",
      nationality: "sa",
      companyCode: "KWI",
      joiningDate: "2024-01-15",
      ...cells,
    },
  };
}

const issuesOf = (r: ImportRow[]) =>
  validateImportRows(r, refs).results.map((x) => x.issues.map((i) => `${i.column ?? "-"}: ${i.message}`));

describe("validateImportRows", () => {
  it("accepts a minimal row and normalises it like the form does", () => {
    const { results, valid } = validateImportRows([row(2, { employeeNo: "kwi-002" })], refs);
    expect(results[0]?.issues).toEqual([]);
    expect(valid[0]?.input).toMatchObject({
      employeeNo: "KWI-002",
      companyId: "kwi",
      nationality: "SA",
      gender: "MALE",
      status: "ACTIVE",
      employmentType: "FULL_TIME",
    });
  });

  it("resolves department and position by name within the row's company", () => {
    const { valid } = validateImportRows(
      [row(2, { employeeNo: "KWI-002", department: "finance", position: "Driver" })],
      refs,
    );
    expect(valid[0]?.input).toMatchObject({ departmentId: "fin", positionId: "drv" });
  });

  it("refuses a department that belongs to another company", () => {
    expect(issuesOf([row(2, { employeeNo: "KWI-002", department: "Operations" })])[0]).toEqual([
      'department: Department "Operations" not found in KWI',
    ]);
  });

  it("refuses numbers already in the system and numbers repeated in the file", () => {
    const issues = issuesOf([
      row(2, { employeeNo: "KWI-001" }),
      row(3, { employeeNo: "KWI-009" }),
      row(4, { employeeNo: "kwi-009" }),
    ]);
    expect(issues[0]).toEqual(["employeeNo: KWI-001 already exists in the system"]);
    expect(issues[1]).toEqual(["employeeNo: KWI-009 is repeated on row 4"]);
    expect(issues[2]).toEqual(["employeeNo: KWI-009 is repeated on row 3"]);
  });

  it("refuses an unknown company without also complaining about every lookup", () => {
    const issues = issuesOf([row(2, { employeeNo: "X-1", companyCode: "ZZZ", department: "Finance" })]);
    expect(issues[0]).toEqual(['companyCode: Company "ZZZ" not found']);
  });

  it("links a manager to an existing employee or to a row in the same file", () => {
    const { results, valid } = validateImportRows(
      [
        row(2, { employeeNo: "KWI-010", managerNo: "kwi-001" }),
        row(3, { employeeNo: "KWI-011", managerNo: "KWI-010" }),
        row(4, { employeeNo: "KWI-012", managerNo: "KWI-999" }),
        row(5, { employeeNo: "KWI-013", managerNo: "KWI-013" }),
        row(6, { employeeNo: "ICC-001", companyCode: "ICC", managerNo: "KWI-010" }),
      ],
      refs,
    );
    expect(valid.map((v) => v.manager)).toEqual([{ existingId: "m1" }, { rowEmployeeNo: "KWI-010" }]);
    expect(results[2]?.issues[0]?.message).toMatch(/not found/);
    expect(results[3]?.issues[0]?.message).toMatch(/themselves/);
    expect(results[4]?.issues[0]?.message).toMatch(/different company/);
  });

  it("applies the form's own rules: missing name, bad email, leaver without a date", () => {
    const issues = issuesOf([
      row(2, { employeeNo: "KWI-020", firstName: "", workEmail: "not-an-email" }),
      row(3, { employeeNo: "KWI-021", status: "Resigned" }),
      row(4, { employeeNo: "KWI-022", workEmail: "Taken@Example.com" }),
    ]);
    expect(issues[0]).toEqual(
      expect.arrayContaining(["firstName: First name is required", "workEmail: Enter a valid email"]),
    );
    expect(issues[1]).toEqual(["lastWorkingDate: A last working date is required when an employee leaves"]);
    expect(issues[2]).toEqual(["workEmail: taken@example.com is already in use"]);
  });

  it("reads enum labels loosely and dates strictly", () => {
    expect(enumFromLabel("employmentType", "full-time")).toBe("FULL_TIME");
    expect(enumFromLabel("status", "ON LEAVE")).toBe("ON_LEAVE");
    expect(enumFromLabel("gender", "f")).toBe("FEMALE");
    expect(enumFromLabel("gender", "other")).toBeNull();

    expect(normaliseDate("2024-02-29")).toEqual({ iso: "2024-02-29" });
    expect(normaliseDate("1/3/2024")).toEqual({ iso: "2024-03-01" });
    expect(normaliseDate("March 1 2024")).toEqual({ error: "Use YYYY-MM-DD" });
    expect(normaliseDate("  ")).toBeNull();

    const issues = issuesOf([row(2, { employeeNo: "KWI-030", employmentType: "Casual", joiningDate: "March 1 2024" })]);
    expect(issues[0]).toEqual([
      'employmentType: "Casual" is not one of: Full time, Part time, Contract, Temporary, Intern',
      "joiningDate: Use YYYY-MM-DD",
    ]);
  });

  it("reports an employee number the form would refuse, once", () => {
    const issues = issuesOf([row(2, { employeeNo: "KWI 001!" })]);
    expect(issues[0]).toEqual(["employeeNo: Letters, digits and - / . _ only"]);
  });
});
