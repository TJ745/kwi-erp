import { describe, expect, it } from "vitest";
import {
  summariseSalaryRows,
  validateSalaryRows,
  type SalaryReferences,
  type SalaryRow,
} from "./salary-import";

const refs: SalaryReferences = {
  employees: new Map([
    [
      "78037",
      {
        id: "e1",
        name: "Mohammed Gulam Moinuddin",
        salary: { basic: "4200.00", transport: null, housing: null, mobile: null, food: null, other: "300.00" },
      },
    ],
    [
      "78154",
      {
        id: "e2",
        name: "Bahaaeldin Mostafa Amin Ali",
        salary: { basic: null, transport: null, housing: null, mobile: null, food: null, other: null },
      },
    ],
  ]),
};

const row = (
  rowNumber: number,
  employeeNo: string,
  basic: string,
  transport = "",
  housing = "",
  other = "",
): SalaryRow => ({
  rowNumber,
  cells: { employeeNo, name: "", company: "", basic, transport, housing, mobile: "", food: "", other },
});

describe("salary sheet validation", () => {
  it("marks an untouched row unchanged and a filled one changed", () => {
    const { results, valid } = validateSalaryRows(
      [row(2, "78037", "4200", "", "", "300"), row(3, "78154", "6640", "1500", "1660", "200")],
      refs,
    );
    expect(results.map((r) => [r.employeeNo, r.changed, r.issues])).toEqual([
      ["78037", false, []],
      ["78154", true, []],
    ]);
    expect(valid.find((v) => v.employeeId === "e2")?.values).toEqual({
      basic: "6640.00",
      transport: "1500.00",
      housing: "1660.00",
      mobile: null,
      food: null,
      other: "200.00",
    });
  });

  it("treats 4200 and 4200.00 as the same amount", () => {
    const { results } = validateSalaryRows([row(2, "78037", "4200.00", "", "", "300.0")], refs);
    expect(results[0]?.changed).toBe(false);
  });

  it("clearing a cell is a change", () => {
    const { results } = validateSalaryRows([row(2, "78037", "4200", "", "", "")], refs);
    expect(results[0]?.changed).toBe(true);
  });

  it("reports unknown IDs, duplicates and bad amounts", () => {
    const { results, valid } = validateSalaryRows(
      [row(2, "99999", "100"), row(3, "78037", "abc"), row(4, "78154", "1"), row(5, "78154", "2")],
      refs,
    );
    expect(results[0]?.issues).toEqual(["Employee 99999 not found"]);
    expect(results[1]?.issues[0]).toContain("Basic Salary");
    expect(results[2]?.issues[0]).toContain("repeated on row 5");
    expect(valid).toHaveLength(0);
    expect(summariseSalaryRows(results).errorCount).toBe(4);
  });
});
