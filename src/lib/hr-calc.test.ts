import { describe, expect, it } from "vitest";
import {
  incrementFigures,
  overallScore,
  suggestedNextLevel,
  type CriterionScore,
} from "./hr-calc";

describe("incrementFigures", () => {
  it("derives amount and percentage from the two salaries", () => {
    const r = incrementFigures("10000.00", "11000.00");
    expect(r.amount).toBe("1000.00");
    expect(r.percentage).toBe("10.000");
  });

  it("handles a fractional percentage", () => {
    const r = incrementFigures("7500.00", "8000.00");
    expect(r.amount).toBe("500.00");
    expect(r.percentage).toBe("6.667");
  });

  // Pay cuts and corrections exist; clamping to zero would misstate them.
  it("represents a decrease as negative", () => {
    const r = incrementFigures("10000.00", "9000.00");
    expect(r.amount).toBe("-1000.00");
    expect(r.percentage).toBe("-10.000");
  });

  it("reports zero for no change", () => {
    const r = incrementFigures("10000.00", "10000.00");
    expect(r.amount).toBe("0.00");
    expect(r.percentage).toBe("0.000");
  });

  // Infinity or NaN in a salary report is worse than a defensible zero.
  it("does not produce Infinity when the current salary is zero", () => {
    const r = incrementFigures("0.00", "5000.00");
    expect(r.amount).toBe("5000.00");
    expect(r.percentage).toBe("0.000");
  });

  it("is exact at halalas rather than drifting", () => {
    const r = incrementFigures("1000.10", "1000.20");
    expect(r.amount).toBe("0.10");
  });

  it("ignores a malformed salary rather than producing NaN", () => {
    const r = incrementFigures("not-a-number", "5000.00");
    expect(r.amount).toBe("5000.00");
    expect(Number.isNaN(Number(r.percentage))).toBe(false);
  });
});

describe("overallScore", () => {
  const s = (criterion: string, weight: string, score: string): CriterionScore => ({
    criterion,
    weight,
    score,
  });

  it("returns null with no criteria", () => {
    expect(overallScore([])).toBeNull();
  });

  it("averages equally weighted criteria", () => {
    expect(overallScore([s("A", "1", "4"), s("B", "1", "2")])).toBe("3.00");
  });

  it("weights criteria by importance", () => {
    // 4 at weight 3, 2 at weight 1 -> (12 + 2) / 4 = 3.5
    expect(overallScore([s("A", "3", "4"), s("B", "1", "2")])).toBe("3.50");
  });

  // A half-filled form should score what was filled, not be silently halved.
  it("normalises by the actual weight total, not an assumed 100", () => {
    expect(overallScore([s("A", "30", "5"), s("B", "20", "5")])).toBe("5.00");
  });

  it("skips zero and negative weights", () => {
    expect(overallScore([s("A", "1", "4"), s("B", "0", "1"), s("C", "-5", "1")])).toBe(
      "4.00",
    );
  });

  it("skips malformed entries rather than producing NaN", () => {
    expect(overallScore([s("A", "1", "4"), s("B", "x", "y")])).toBe("4.00");
  });

  it("returns null when every weight is unusable", () => {
    expect(overallScore([s("A", "0", "4")])).toBeNull();
  });

  it("rounds to two decimals", () => {
    expect(overallScore([s("A", "1", "3.333"), s("B", "1", "3.333")])).toBe("3.33");
  });
});

describe("suggestedNextLevel", () => {
  it("starts at verbal", () => {
    expect(suggestedNextLevel([])).toBe("VERBAL");
  });

  it("escalates one step at a time", () => {
    expect(suggestedNextLevel(["VERBAL"])).toBe("FIRST_WRITTEN");
    expect(suggestedNextLevel(["VERBAL", "FIRST_WRITTEN"])).toBe("SECOND_WRITTEN");
    expect(suggestedNextLevel(["VERBAL", "FIRST_WRITTEN", "SECOND_WRITTEN"])).toBe("FINAL");
  });

  it("escalates from the highest previous level, whatever the order", () => {
    expect(suggestedNextLevel(["SECOND_WRITTEN", "VERBAL"])).toBe("FINAL");
  });

  it("stops at final rather than running off the end", () => {
    expect(suggestedNextLevel(["FINAL"])).toBe("FINAL");
    expect(suggestedNextLevel(["FINAL", "FINAL"])).toBe("FINAL");
  });
});
