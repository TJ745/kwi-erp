import { describe, expect, it } from "vitest";
import {
  emptyStaffData,
  emptyWorkerData,
  progressMarksReached,
  summaryBoxOf,
  readStaffData,
  STAFF_COMPETENCIES,
  staffDataSchema,
  staffSuggestion,
  timeBetween,
  WORKER_CRITERIA,
  workerDataSchema,
  workerResult,
} from "./evaluation-forms";
import { saveStaffEvaluationSchema } from "./schemas/evaluations";

describe("worker appraisal", () => {
  it("adds the ten scores up out of 100", () => {
    const scores = Object.fromEntries(WORKER_CRITERIA.map((c) => [c.key, "7"]));
    expect(workerResult(workerDataSchema.parse({ scores }))).toBe(70);
    expect(workerResult(emptyWorkerData())).toBeNull();
  });

  it("counts only the scores given", () => {
    expect(
      workerResult(workerDataSchema.parse({ scores: { punctuality: "9", loyalty: "10" } })),
    ).toBe(19);
  });

  it("shades the progress meter up to the result", () => {
    expect(progressMarksReached(72)).toBe(7); // 5, 20 … 70
    expect(progressMarksReached(100)).toBe(10);
    expect(progressMarksReached(4)).toBe(0);
    expect(progressMarksReached(null)).toBe(0);
  });

  it("only accepts scores from 1 to 10", () => {
    for (const bad of ["0", "11", "7.5", "x"]) {
      expect(workerDataSchema.safeParse({ scores: { punctuality: bad } }).success, bad).toBe(false);
    }
    expect(workerDataSchema.safeParse({ scores: { nonsense: "5" } }).success).toBe(false);
  });

  it("puts the result in the summary box its percentage falls in", () => {
    expect(summaryBoxOf(64)).toBe(3);
    expect(summaryBoxOf(10)).toBe(1);
    expect(summaryBoxOf(25)).toBe(1);
    expect(summaryBoxOf(26)).toBe(2);
    expect(summaryBoxOf(75)).toBe(3);
    expect(summaryBoxOf(76)).toBe(4);
    expect(summaryBoxOf(100)).toBe(4);
    expect(summaryBoxOf(null)).toBeNull();
  });
});

describe("staff form", () => {
  it("starts blank with every competency present", () => {
    const d = emptyStaffData();
    expect(d.goals).toEqual([]);
    expect(Object.keys(d.competencies)).toHaveLength(STAFF_COMPETENCIES.length);
    expect(d.competencies.loyalty).toEqual({ rating: "", comment: "" });
  });

  it("suggests a final rating from weighted goals and the competency average", () => {
    const d = staffDataSchema.parse({
      goals: [
        { category: "Sales", weight: "60", rating: "5" },
        { category: "Quality", weight: "40", rating: "3" },
      ],
      competencies: { analytical: { rating: "4" }, loyalty: { rating: "2" } },
    });
    // goals: (60×5 + 40×3) / 100 = 4.2; competencies: (4 + 2) / 2 = 3; overall 3.6
    expect(staffSuggestion(d)).toEqual({ goals: 4.2, competencies: 3, overall: 3.6 });
  });

  it("refuses weights over 100% in total and ratings outside 1–5", () => {
    expect(staffDataSchema.safeParse({ goals: [{ weight: "70" }, { weight: "40" }] }).success).toBe(
      false,
    );
    // Goal ratings are typed freely; competency ratings stay 1–5.
    expect(staffDataSchema.safeParse({ goals: [{ rating: "Exceeded" }] }).success).toBe(true);
    expect(staffDataSchema.safeParse({ competencies: { loyalty: { rating: "6" } } }).success).toBe(
      false,
    );
    expect(
      staffDataSchema.safeParse({ goals: Array.from({ length: 6 }, () => ({})) }).success,
    ).toBe(false);
  });

  it("reads damaged stored JSON as a blank form instead of failing", () => {
    expect(readStaffData({ goals: "nope" })).toEqual(emptyStaffData());
  });

  it("checks the plan dates are in order", () => {
    const base = { id: "e1", evaluationDate: "2026-11-18", data: {} };
    expect(
      saveStaffEvaluationSchema.safeParse({
        ...base,
        pdpStarted: "2026-06-01",
        pdpCompleted: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      saveStaffEvaluationSchema.safeParse({
        ...base,
        pdpStarted: "2026-01-01",
        pdpCompleted: "2026-06-01",
      }).success,
    ).toBe(true);
  });

  it("describes time in position", () => {
    expect(timeBetween(new Date("2024-08-15"), new Date("2026-11-18"))).toBe("2 years 3 months");
    expect(timeBetween(new Date("2026-11-01"), new Date("2026-11-18"))).toBe("Less than a month");
    expect(timeBetween(new Date("2025-11-18"), new Date("2026-11-18"))).toBe("1 year");
  });
});
