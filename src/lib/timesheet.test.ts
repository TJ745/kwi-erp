import { describe, expect, it } from "vitest";
import {
  datesInRange,
  summarise,
  validateHours,
  type TimesheetDay,
} from "./timesheet";

const day = (over: Partial<TimesheetDay> = {}): TimesheetDay => ({
  normalHours: "8",
  overtimeHours: "0",
  delayedHours: "0",
  absent: false,
  status: "APPROVED",
  ...over,
});

describe("summarise", () => {
  it("returns zeros for an empty period", () => {
    const s = summarise([]);
    expect(s.daysRecorded).toBe(0);
    expect(s.normalHours).toBe(0);
  });

  it("totals approved hours", () => {
    const s = summarise([day(), day(), day({ overtimeHours: "2" })]);
    expect(s.normalHours).toBe(24);
    expect(s.overtimeHours).toBe(2);
    expect(s.daysRecorded).toBe(3);
  });

  // Payroll acts on approved hours; a pending day is still a claim.
  it("keeps pending hours out of the approved totals", () => {
    const s = summarise([day(), day({ status: "PENDING", overtimeHours: "3" })]);
    expect(s.normalHours).toBe(8);
    expect(s.overtimeHours).toBe(0);
    expect(s.pendingHours).toBe(11);
  });

  it("treats rejected and cancelled as history, not claims", () => {
    const s = summarise([
      day({ status: "REJECTED" }),
      day({ status: "CANCELLED", overtimeHours: "5" }),
    ]);
    expect(s.normalHours).toBe(0);
    expect(s.pendingHours).toBe(0);
    expect(s.daysRecorded).toBe(2);
  });

  it("counts absences regardless of status", () => {
    const s = summarise([
      day({ absent: true, normalHours: "0" }),
      day({ absent: true, normalHours: "0", status: "PENDING" }),
    ]);
    expect(s.daysAbsent).toBe(2);
  });

  it("accumulates delayed hours from approved days only", () => {
    const s = summarise([
      day({ delayedHours: "0.5" }),
      day({ delayedHours: "1.25" }),
      day({ delayedHours: "9", status: "PENDING" }),
    ]);
    expect(s.delayedHours).toBe(1.75);
  });

  // Quarter-hours summed across a month are where float drift shows up.
  it("does not drift across a month of quarter-hours", () => {
    const days = Array.from({ length: 30 }, () => day({ normalHours: "7.25" }));
    expect(summarise(days).normalHours).toBe(217.5);
  });

  it("ignores malformed hours rather than producing NaN", () => {
    const s = summarise([day({ normalHours: "abc" }), day()]);
    expect(s.normalHours).toBe(8);
  });
});

describe("validateHours", () => {
  const base = {
    normalHours: "8",
    overtimeHours: "0",
    delayedHours: "0",
    absent: false,
  };

  it("accepts an ordinary day", () => {
    expect(validateHours(base)).toEqual([]);
  });

  it("rejects negative hours on any field", () => {
    expect(validateHours({ ...base, normalHours: "-1" })).toHaveLength(1);
    expect(validateHours({ ...base, overtimeHours: "-1" })).toHaveLength(1);
    expect(validateHours({ ...base, delayedHours: "-1" })).toHaveLength(1);
  });

  // Usually a date typed into the hours box; it would inflate overtime pay.
  it("rejects more than 24 hours worked in a day", () => {
    const problems = validateHours({ ...base, normalHours: "20", overtimeHours: "5" });
    expect(problems.some((p) => p.message.includes("24"))).toBe(true);
  });

  it("accepts exactly 24 hours", () => {
    expect(validateHours({ ...base, normalHours: "16", overtimeHours: "8" })).toEqual([]);
  });

  it("rejects an absent day that also has hours", () => {
    const problems = validateHours({ ...base, absent: true, normalHours: "8" });
    expect(problems.some((p) => p.message.includes("absent"))).toBe(true);
  });

  it("accepts an absent day with no hours", () => {
    expect(
      validateHours({ ...base, absent: true, normalHours: "0", overtimeHours: "0" }),
    ).toEqual([]);
  });

  // A form should mark every bad field at once, not one per submit.
  it("reports every problem, not just the first", () => {
    const problems = validateHours({
      normalHours: "-1",
      overtimeHours: "-2",
      delayedHours: "-3",
      absent: false,
    });
    expect(problems).toHaveLength(3);
  });
});

describe("datesInRange", () => {
  it("is inclusive of both ends", () => {
    const days = datesInRange(new Date("2026-03-01"), new Date("2026-03-03"));
    expect(days).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("returns a single day when from equals to", () => {
    expect(datesInRange(new Date("2026-03-01"), new Date("2026-03-01"))).toEqual([
      "2026-03-01",
    ]);
  });

  it("returns nothing when the range is backwards", () => {
    expect(datesInRange(new Date("2026-03-05"), new Date("2026-03-01"))).toEqual([]);
  });

  it("crosses a month boundary", () => {
    const days = datesInRange(new Date("2026-01-30"), new Date("2026-02-02"));
    expect(days).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("handles a leap day", () => {
    const days = datesInRange(new Date("2028-02-28"), new Date("2028-03-01"));
    expect(days).toContain("2028-02-29");
  });

  // A mistyped year must not spin the request forever.
  it("is bounded so a hostile range cannot run away", () => {
    const days = datesInRange(new Date("2026-01-01"), new Date("2999-01-01"));
    expect(days).toHaveLength(366);
  });
});
