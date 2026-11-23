import { describe, expect, it } from "vitest";
import {
  applyBrush,
  delayLabel,
  initialDays,
  monthLabel,
  periodDays,
  rowTotals,
  type DayCode,
} from "./timesheet";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("timesheet", () => {
  it("runs from the 16th of the previous month to the 15th", () => {
    const days = periodDays("2026-11");
    expect(days).toHaveLength(31);
    expect(days[0]!.toISOString().slice(0, 10)).toBe("2026-10-16");
    expect(days[30]!.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(periodDays("2026-03")).toHaveLength(28); // 16 Feb – 15 Mar
    expect(periodDays("2026-01")[0]!.toISOString().slice(0, 10)).toBe("2025-12-16");
    expect(monthLabel("2026-11")).toBe("Nov-26");
  });

  it("starts with P, Fridays off, and leave over the top", () => {
    const days = periodDays("2026-11");
    const codes = initialDays({
      days,
      weekend: "FRI",
      joiningDate: d("2020-01-01"),
      lastWorkingDate: null,
      leave: [{ start: d("2026-11-03"), end: d("2026-11-04"), typeKey: "SICK" }],
    });
    expect(codes[0]).toBe("FRI"); // 16 Oct 2026 is a Friday
    expect(codes[1]).toBe("P");
    expect(codes[18]).toBe("S"); // 3 Nov
    const two = initialDays({
      days,
      weekend: "FRI_SAT",
      joiningDate: d("2020-01-01"),
      lastWorkingDate: null,
      leave: [],
    });
    expect(two.slice(0, 3)).toEqual(["FRI", "SAT", "P"]);
  });

  it("blanks the days after a last working day", () => {
    const codes = initialDays({
      days: periodDays("2026-11"),
      weekend: "FRI",
      joiningDate: d("2020-01-01"),
      lastWorkingDate: d("2026-10-28"),
      leave: [],
    });
    expect(codes[12]).toBe("P"); // 28 Oct
    expect(codes[13]).toBe(""); // 29 Oct
  });

  it("adds up a row like the company's sheet (RAM PRATAP, Nov-26)", () => {
    // 22 P, 3 A, 1 S, 5 FRI → 22 / 0 / 3 / 6 / 28
    const codes: DayCode[] = [
      ...Array<DayCode>(22).fill("P"),
      ...Array<DayCode>(3).fill("A"),
      "S",
      ...Array<DayCode>(5).fill("FRI"),
    ];
    const t = rowTotals(codes, [2, null, 2]);
    expect(t).toEqual({
      working: 22,
      absent: 3,
      vacation: 0,
      fridaysHolidays: 6,
      monthDays: 28,
      extra: 4,
    });
  });

  it("counts LWOP as absent and a full month's vacation as no paid days", () => {
    expect(rowTotals(Array<DayCode>(31).fill("L"), []).absent).toBe(31);
    const v = rowTotals(Array<DayCode>(31).fill("V"), []);
    expect([v.vacation, v.monthDays]).toEqual([31, 0]);
  });

  it("marks days by clicking", () => {
    expect(applyBrush("P", "TOGGLE", null)).toBe("A");
    expect(applyBrush("A", "TOGGLE", null)).toBe("P");
    expect(applyBrush("FRI", "TOGGLE", "FRI")).toBe("FRI");
    expect(applyBrush("P", "V", null)).toBe("V");
    expect(applyBrush("V", "V", null)).toBe("P");
    expect(applyBrush("V", "V", "FRI")).toBe("FRI");
    expect(applyBrush("", "V", null)).toBe("");
    expect(delayLabel(85)).toBe("1 Hrs 25 Mins");
  });
});
