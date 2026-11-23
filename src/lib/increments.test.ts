import { describe, expect, it } from "vitest";
import {
  applyIncrement,
  formatAmount,
  incrementOf,
  parseAmount,
  sumBreakdowns,
  total,
  type Breakdown,
} from "./increments";
import { saveListLinesSchema, employeeSalarySchema } from "./schemas/increments";

const b = (basic: string, transport: string, housing: string, other: string): Breakdown => ({
  basic,
  transport,
  housing,
  other,
});

// The two rows of the company's sheet dated 29.04.2026.
const foremanCurrent = b("4200", "0", "0", "300");
const engineerCurrent = b("6640", "1500", "1660", "200");

describe("increment arithmetic", () => {
  it("totals a breakdown", () => {
    expect(total(foremanCurrent)).toBe("4500.00");
    expect(total(engineerCurrent)).toBe("10000.00");
  });

  it("puts a typed increment on the basic salary, as the sheet does", () => {
    // Foreman: demand 2,000 → basic 6,200, total 6,500.
    const demanded = applyIncrement(foremanCurrent, foremanCurrent, "2000")!;
    expect(demanded.basic).toBe("6200.00");
    expect(total(demanded)).toBe("6500.00");
    // Engineer: proposed 1,000 → basic 7,640, total 11,000, allowances untouched.
    const proposed = applyIncrement(engineerCurrent, engineerCurrent, "1000")!;
    expect(proposed).toEqual({ ...engineerCurrent, basic: "7640.00" });
    expect(total(proposed)).toBe("11000.00");
  });

  it("keeps the increment equal to new total minus current total", () => {
    const next = b("6640", "1500", "2000", "200");
    expect(incrementOf(engineerCurrent, next)).toBe("340.00");
    // Changing an allowance first, then typing the increment, still lands on it.
    const withInc = applyIncrement(engineerCurrent, next, "1000")!;
    expect(incrementOf(engineerCurrent, withInc)).toBe("1000.00");
    expect(withInc.housing).toBe("2000");
  });

  it("represents a decrease", () => {
    expect(incrementOf(foremanCurrent, b("4000", "0", "0", "300"))).toBe("-200.00");
  });

  it("sums the Total Amount SR row", () => {
    const totals = sumBreakdowns([foremanCurrent, engineerCurrent]);
    expect(totals).toEqual(b("10840.00", "1500.00", "1660.00", "500.00"));
    expect(total(totals)).toBe("14500.00");
  });

  it("does not drift on decimals", () => {
    expect(total(b("0.1", "0.2", "0", "0"))).toBe("0.30");
  });

  it("rejects what is not an amount", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("1,000")).toBe(100000);
    expect(parseAmount("")).toBe(0);
    expect(applyIncrement(foremanCurrent, foremanCurrent, "x")).toBeNull();
  });

  it("formats like the sheet: thousands separators, a dash for zero", () => {
    expect(formatAmount("6640.00")).toBe("6,640");
    expect(formatAmount("0")).toBe("-");
    expect(formatAmount("0", { dashForZero: false })).toBe("0");
    expect(formatAmount("1250.5")).toBe("1,250.50");
  });
});

describe("increment schemas", () => {
  it("normalises saved amounts and refuses junk", () => {
    const ok = saveListLinesSchema.parse({
      listId: "l1",
      lines: [
        { id: "a", demanded: b("6,200", "", "0", "300"), proposed: b("5200", "0", "0", "300") },
      ],
    });
    expect(ok.lines[0]!.demanded).toEqual(b("6200.00", "0.00", "0.00", "300.00"));
    expect(
      saveListLinesSchema.safeParse({
        listId: "l1",
        lines: [{ id: "a", demanded: b("abc", "0", "0", "0"), proposed: b("0", "0", "0", "0") }],
      }).success,
    ).toBe(false);
  });

  it("keeps a blank salary part as not recorded", () => {
    const parsed = employeeSalarySchema.parse({
      employeeId: "e1",
      basic: "4200",
      transport: "",
      housing: "0",
      other: "300",
    });
    expect(parsed).toEqual({
      employeeId: "e1",
      basic: "4200.00",
      transport: null,
      housing: "0.00",
      other: "300.00",
    });
  });
});
