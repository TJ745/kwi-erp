import { describe, expect, it } from "vitest";
import { buildPositionTree, isCountedPosition, type ChartPosition } from "./position-chart";

const pos = (
  id: string,
  title: string,
  reportsToId: string | null,
  people: [string, string, boolean?][] = [],
  budgeted = 0,
): ChartPosition => ({
  id,
  title,
  reportsToId,
  budgeted,
  people: people.map(([name, companyCode, saudi]) => ({
    name,
    companyCode,
    saudi: saudi ?? false,
  })),
});

describe("organization chart", () => {
  it("counts the trades and names everyone else", () => {
    expect(isCountedPosition("Carpenter")).toBe(true);
    expect(isCountedPosition("Carpenter Helper")).toBe(true);
    expect(isCountedPosition("Painter")).toBe(true);
    expect(isCountedPosition("Painter Foreman")).toBe(false);
    expect(isCountedPosition("Driver")).toBe(false);
  });

  it("builds the tree along reports-to, with counts and vacancies", () => {
    const tree = buildPositionTree([
      pos("gm", "General Manager", null, [["Naser", "ICC"]]),
      pos("ps", "Production Supervisor", "gm", [["Sari", "KWI"]]),
      pos("pa", "Painter", "ps", [
        ["A", "KWI"],
        ["B", "KWI"],
        ["C", "ICC"],
        ["D", "KWI", true],
      ]),
      pos("pm", "Production Manager", "gm"),
      pos("hr", "HR Officer", null), // empty and outside the structure
    ]);
    expect(tree).toHaveLength(1);
    const gm = tree[0]!;
    expect(gm.title).toBe("General Manager");
    expect(gm.children.map((c) => c.title)).toEqual([
      "Production Manager",
      "Production Supervisor",
    ]);
    const pm = gm.children[0]!;
    expect(pm.vacant).toBe(true);
    const painter = gm.children[1]!.children[0]!;
    expect(painter.people).toEqual([]);
    expect(painter.counts).toEqual([
      { label: "(ICC)", companyCode: "ICC", count: 1 },
      { label: "(KWI)", companyCode: "KWI", count: 2 },
      { label: "Saudi (KWI)", companyCode: "KWI", count: 1 },
    ]);
  });

  it("does not loop on a reports-to cycle", () => {
    const tree = buildPositionTree([
      pos("a", "A", "b", [["x", "KWI"]]),
      pos("b", "B", "a", [["y", "KWI"]]),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.children).toHaveLength(0);
  });
});
