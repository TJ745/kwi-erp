import { describe, expect, it } from "vitest";
import { monthLabel, monthStart, timesheetFileSchema } from "./timesheet";

const VALID = { companyId: "c1", month: "2026-11", fileId: "f1" };

describe("timesheet file schema", () => {
  it("accepts a company, a month, and an uploaded file", () => {
    expect(timesheetFileSchema.safeParse(VALID).success).toBe(true);
  });

  it("needs all three", () => {
    expect(timesheetFileSchema.safeParse({ ...VALID, companyId: "" }).success).toBe(false);
    expect(timesheetFileSchema.safeParse({ ...VALID, fileId: "" }).success).toBe(false);
    expect(timesheetFileSchema.safeParse({ ...VALID, month: "" }).success).toBe(false);
  });

  it("only accepts a real YYYY-MM month", () => {
    for (const month of ["2026-13", "2026-00", "2026-1", "Nov 2026", "2026-11-01"]) {
      expect(timesheetFileSchema.safeParse({ ...VALID, month }).success, month).toBe(false);
    }
  });

  it("rejects unknown keys", () => {
    expect(timesheetFileSchema.safeParse({ ...VALID, hours: "8" }).success).toBe(false);
  });
});

describe("month helpers", () => {
  it("stores the first day of the month, in UTC", () => {
    expect(monthStart("2026-11").toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(monthStart("2026-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("labels a month the way people say it", () => {
    expect(monthLabel(monthStart("2026-11"))).toBe("November 2026");
    // Not shifted into the previous month by a local timezone.
    expect(monthLabel(monthStart("2027-01"))).toBe("January 2027");
  });
});
