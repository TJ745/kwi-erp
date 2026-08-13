import { describe, expect, it } from "vitest";
import {
  calculateBalance,
  formatAmount,
  wouldOverdraw,
  type LedgerEntry,
} from "./petty-cash";

const entry = (
  type: "INCOME" | "EXPENSE",
  amount: string,
  status: LedgerEntry["status"] = "APPROVED",
): LedgerEntry => ({ type, amount, status });

describe("calculateBalance", () => {
  it("returns the opening balance for an empty ledger", () => {
    const b = calculateBalance("5000.00", []);
    expect(b.current).toBe(5000);
    expect(b.projected).toBe(5000);
  });

  it("adds approved income and subtracts approved expense", () => {
    const b = calculateBalance("1000.00", [
      entry("INCOME", "500.00"),
      entry("EXPENSE", "200.00"),
      entry("EXPENSE", "50.50"),
    ]);
    expect(b.current).toBe(1249.5);
    expect(b.totalIn).toBe(500);
    expect(b.totalOut).toBe(250.5);
  });

  // The rule that matters: a request is a claim on the tin, not a withdrawal.
  it("ignores pending transactions in the current balance", () => {
    const b = calculateBalance("1000.00", [
      entry("EXPENSE", "300.00", "PENDING"),
      entry("INCOME", "999.00", "PENDING"),
    ]);
    expect(b.current).toBe(1000);
    expect(b.pendingOut).toBe(300);
  });

  it("projects what the balance becomes if every pending expense is approved", () => {
    const b = calculateBalance("1000.00", [
      entry("EXPENSE", "100.00"),
      entry("EXPENSE", "300.00", "PENDING"),
      entry("EXPENSE", "50.00", "PENDING"),
    ]);
    expect(b.current).toBe(900);
    expect(b.projected).toBe(550);
  });

  it("treats rejected and cancelled as history, not claims", () => {
    const b = calculateBalance("1000.00", [
      entry("EXPENSE", "400.00", "REJECTED"),
      entry("EXPENSE", "400.00", "CANCELLED"),
    ]);
    expect(b.current).toBe(1000);
    expect(b.pendingOut).toBe(0);
    expect(b.projected).toBe(1000);
  });

  // Float arithmetic is the classic way a petty-cash tin stops reconciling.
  it("does not accumulate floating-point error across many entries", () => {
    const entries = Array.from({ length: 300 }, () => entry("EXPENSE", "0.10"));
    const b = calculateBalance("100.00", entries);
    expect(b.current).toBe(70);
    expect(b.totalOut).toBe(30);
  });

  it("handles the 0.1 + 0.2 case exactly", () => {
    const b = calculateBalance("0.00", [entry("INCOME", "0.10"), entry("INCOME", "0.20")]);
    expect(b.current).toBe(0.3);
  });

  it("allows a negative balance to be represented rather than clamped", () => {
    // The service prevents reaching this, but the arithmetic must not lie
    // about an account that is already overdrawn from an earlier correction.
    const b = calculateBalance("100.00", [entry("EXPENSE", "250.00")]);
    expect(b.current).toBe(-150);
  });

  it("ignores a malformed amount rather than producing NaN", () => {
    const b = calculateBalance("100.00", [entry("EXPENSE", "not-a-number")]);
    expect(b.current).toBe(100);
  });
});

describe("wouldOverdraw", () => {
  it("permits an expense equal to the balance", () => {
    expect(wouldOverdraw(500, "500.00")).toBe(false);
  });

  it("refuses an expense one halala over the balance", () => {
    expect(wouldOverdraw(500, "500.01")).toBe(true);
  });

  it("refuses any expense against an empty tin", () => {
    expect(wouldOverdraw(0, "0.01")).toBe(true);
  });

  it("permits a zero-value expense", () => {
    expect(wouldOverdraw(0, "0.00")).toBe(false);
  });

  it("is exact at fractional balances", () => {
    expect(wouldOverdraw(1249.5, "1249.50")).toBe(false);
    expect(wouldOverdraw(1249.5, "1249.51")).toBe(true);
  });
});

describe("formatAmount", () => {
  it("always shows two decimal places", () => {
    expect(formatAmount(1000)).toBe("1,000.00 SAR");
    expect(formatAmount(0.5)).toBe("0.50 SAR");
  });

  it("accepts a different currency", () => {
    expect(formatAmount(25, "USD")).toBe("25.00 USD");
  });

  it("shows a negative balance as negative", () => {
    expect(formatAmount(-150)).toBe("-150.00 SAR");
  });
});
