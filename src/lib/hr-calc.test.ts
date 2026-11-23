import { describe, expect, it } from "vitest";
import { suggestedNextLevel } from "./hr-calc";

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
