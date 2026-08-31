import { describe, expect, it } from "vitest";
import { assignCompanyColours } from "./org-tree";

describe("assignCompanyColours", () => {
  it("gives every company its own slot, in a stable order", () => {
    const a = assignCompanyColours(["KWI", "ICC"]);
    const b = assignCompanyColours(["ICC", "KWI"]);
    // Sorted, so input order cannot change what colour a company gets — a
    // chart that repaints itself when a company is added elsewhere is worse
    // than one with dull colours.
    expect(a.get("ICC")).toBe(b.get("ICC"));
    expect(a.get("KWI")).toBe(b.get("KWI"));
    expect(a.get("ICC")).not.toBe(a.get("KWI"));
  });

  it("does not repeat a hue within the four validated slots", () => {
    const map = assignCompanyColours(["A", "B", "C", "D"]);
    expect(new Set(map.values()).size).toBe(4);
  });

  it("falls back to the neutral slot past the fourth company", () => {
    const map = assignCompanyColours(["A", "B", "C", "D", "E", "F"]);
    expect(map.get("E")).toBe("var(--chart-cat-other)");
    expect(map.get("F")).toBe("var(--chart-cat-other)");
  });

  it("de-duplicates repeated codes", () => {
    const map = assignCompanyColours(["KWI", "KWI", "ICC"]);
    expect(map.size).toBe(2);
  });

  it("handles an empty organisation", () => {
    expect(assignCompanyColours([]).size).toBe(0);
  });
});
