import { describe, expect, it } from "vitest";
import type { PermissionKey } from "./permissions";
import {
  expiryBucketLabel,
  isCompanyInScope,
  isReportId,
  REPORT_IDS,
  REPORT_LIST,
  REPORTS,
  visibleColumns,
  visibleReports,
} from "./reports";

const perms = (...keys: PermissionKey[]) => new Set<PermissionKey>(keys);

describe("catalogue integrity", () => {
  it("every id resolves to a spec with a matching id", () => {
    for (const id of REPORT_IDS) {
      expect(REPORTS[id].id).toBe(id);
    }
  });

  it("column keys are unique within a report", () => {
    for (const report of REPORT_LIST) {
      const keys = report.columns.map((c) => c.key);
      expect(new Set(keys).size, `${report.id} has duplicate column keys`).toBe(keys.length);
    }
  });

  it("every report has at least one ungated column", () => {
    // A report where every column is gated would render as an empty table for
    // some roles, which reads as "no data" rather than "not permitted".
    for (const report of REPORT_LIST) {
      expect(
        report.columns.some((c) => c.permission === undefined),
        `${report.id} has no ungated column`,
      ).toBe(true);
    }
  });

  it("isReportId rejects anything not in the catalogue", () => {
    expect(isReportId("employee-directory")).toBe(true);
    expect(isReportId("../../etc/passwd")).toBe(false);
    expect(isReportId("")).toBe(false);
  });
});

describe("visibleColumns", () => {
  const directory = REPORTS["employee-directory"];

  it("omits a gated column when the permission is absent", () => {
    const keys = visibleColumns(directory, perms("employees.view")).map((c) => c.key);
    expect(keys).not.toContain("basicSalary");
    expect(keys).not.toContain("iban");
    expect(keys).toContain("fullName");
  });

  it("includes a gated column when the permission is held", () => {
    const keys = visibleColumns(
      directory,
      perms("employees.view", "employees.salary.view"),
    ).map((c) => c.key);
    expect(keys).toContain("basicSalary");
    expect(keys).not.toContain("iban");
  });

  it("gates each column independently", () => {
    const keys = visibleColumns(directory, perms("employees.bank.view")).map((c) => c.key);
    expect(keys).toContain("iban");
    expect(keys).not.toContain("basicSalary");
  });

  it("preserves declaration order", () => {
    const all = visibleColumns(
      directory,
      perms("employees.salary.view", "employees.bank.view"),
    ).map((c) => c.key);
    expect(all).toEqual(directory.columns.map((c) => c.key));
  });

  it("returns nothing gated for an empty permission set", () => {
    const gated = visibleColumns(directory, perms()).filter((c) => c.permission !== undefined);
    expect(gated).toEqual([]);
  });

  // The property that matters: screen and export share this function, so a
  // column can never appear in one and not the other.
  it("is deterministic for the same permission set", () => {
    const a = visibleColumns(directory, perms("employees.salary.view"));
    const b = visibleColumns(directory, perms("employees.salary.view"));
    expect(a.map((c) => c.key)).toEqual(b.map((c) => c.key));
  });

  it("gates the salary column on every report that declares one", () => {
    for (const report of REPORT_LIST) {
      const salaryColumns = report.columns.filter((c) => c.key === "basicSalary");
      for (const column of salaryColumns) {
        expect(column.permission, `${report.id}.basicSalary is ungated`).toBe(
          "employees.salary.view",
        );
      }
    }
  });

  /**
   * A money column that names a person's pay must never be ungated, whatever
   * the report is called. Keyed on the column name rather than the report so a
   * new report cannot quietly introduce an unguarded one.
   */
  it("gates every column that carries a salary figure, on any report", () => {
    const PAY_COLUMNS = new Set([
      "basicSalary",
      "currentSalary",
      "newSalary",
      "percentage",
    ]);

    for (const report of REPORT_LIST) {
      for (const column of report.columns) {
        if (!PAY_COLUMNS.has(column.key)) continue;
        expect(column.permission, `${report.id}.${column.key} is ungated`).toBe(
          "employees.salary.view",
        );
      }
    }
  });

  it("hides the increment figures but keeps the rest of the report usable", () => {
    const report = REPORTS["increment-register"];

    const withoutSalary = visibleColumns(report, perms("hr.increments.view")).map((c) => c.key);
    // Seeing that a rise happened is a different question from seeing its size.
    expect(withoutSalary).toContain("employeeNo");
    expect(withoutSalary).toContain("effectiveDate");
    expect(withoutSalary).toContain("status");
    expect(withoutSalary).not.toContain("currentSalary");
    expect(withoutSalary).not.toContain("newSalary");
    expect(withoutSalary).not.toContain("amount");
    expect(withoutSalary).not.toContain("percentage");

    // The control: with the permission the figures come back, so the absence
    // above is the gate and not a missing column.
    const withSalary = visibleColumns(
      report,
      perms("hr.increments.view", "employees.salary.view"),
    ).map((c) => c.key);
    expect(withSalary).toContain("currentSalary");
    expect(withSalary).toContain("newSalary");
  });
});

describe("visibleReports", () => {
  it("returns nothing without reports.view, whatever else is held", () => {
    expect(visibleReports(perms("employees.view", "vehicles.view"))).toEqual([]);
  });

  it("returns only reports whose domain permission is held", () => {
    const ids = visibleReports(perms("reports.view", "employees.view")).map((r) => r.id);
    expect(ids).toContain("employee-directory");
    expect(ids).not.toContain("fleet-register");
  });

  it("returns everything for a full permission set", () => {
    const all = new Set<PermissionKey>(REPORT_LIST.map((r) => r.permission));
    all.add("reports.view");
    expect(visibleReports(all)).toHaveLength(REPORT_LIST.length);
  });
});

describe("isCompanyInScope", () => {
  it("accepts a company inside a limited scope", () => {
    expect(isCompanyInScope(["kwi", "icc"], "kwi")).toBe(true);
  });

  // The important direction: an out-of-scope filter must be a denial, not
  // something the caller may quietly ignore and return the full scope for.
  it("rejects a company outside a limited scope", () => {
    expect(isCompanyInScope(["kwi"], "icc")).toBe(false);
  });

  it("accepts anything under an ALL scope", () => {
    expect(isCompanyInScope("ALL", "anything")).toBe(true);
  });

  it("rejects everything under an empty scope", () => {
    expect(isCompanyInScope([], "kwi")).toBe(false);
  });

  it("does not match on a prefix", () => {
    expect(isCompanyInScope(["kwi"], "kwi2")).toBe(false);
  });
});

describe("expiryBucketLabel", () => {
  it("labels a past date as expired", () => {
    expect(expiryBucketLabel(-1)).toBe("Expired");
    expect(expiryBucketLabel(-90)).toBe("Expired");
  });

  it("uses the tightest matching bucket", () => {
    expect(expiryBucketLabel(0)).toBe("7 days");
    expect(expiryBucketLabel(7)).toBe("7 days");
    expect(expiryBucketLabel(8)).toBe("15 days");
    expect(expiryBucketLabel(30)).toBe("30 days");
    expect(expiryBucketLabel(31)).toBe("60 days");
    expect(expiryBucketLabel(90)).toBe("90 days");
  });

  it("labels anything beyond the widest bucket as later", () => {
    expect(expiryBucketLabel(91)).toBe("Later");
  });
});
