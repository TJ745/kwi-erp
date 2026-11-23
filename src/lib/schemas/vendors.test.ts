import { describe, expect, it } from "vitest";
import {
  MAX_RATE_LINES,
  splitTerms,
  subcontractDefaultsSchema,
  subcontractorContractSchema,
} from "./vendors";

const VALID = {
  subcontractorId: "s1",
  companyId: "c1",
  contractNo: "SC-001",
  startDate: "2025-05-01",
  endDate: "2025-10-31",
};

describe("subcontract agreement fields", () => {
  it("still accepts a contract with no rates, terms, or agreement date", () => {
    const parsed = subcontractorContractSchema.parse(VALID);
    expect(parsed.rates).toEqual([]);
    expect(parsed.terms).toBeUndefined();
    expect(parsed.agreementDate).toBeUndefined();
  });

  it("accepts a rate schedule with per-row units", () => {
    const parsed = subcontractorContractSchema.parse({
      ...VALID,
      agreementDate: "2025-06-30",
      rates: [
        { category: "Labor (helper)", rate: "12", unit: "HOUR" },
        { category: "Painter", rate: "20.50", unit: "DAY" },
      ],
    });
    expect(parsed.rates).toHaveLength(2);
    expect(parsed.agreementDate?.toISOString().slice(0, 10)).toBe("2025-06-30");
  });

  it("rejects a rate row without a category, a bad amount, or an unknown unit", () => {
    for (const row of [
      { category: "", rate: "12", unit: "HOUR" },
      { category: "Helper", rate: "12.345", unit: "HOUR" },
      { category: "Helper", rate: "-1", unit: "HOUR" },
      { category: "Helper", rate: "12", unit: "WEEK" },
    ]) {
      expect(subcontractorContractSchema.safeParse({ ...VALID, rates: [row] }).success).toBe(false);
    }
  });

  it("caps the schedule length", () => {
    const rates = Array.from({ length: MAX_RATE_LINES + 1 }, () => ({
      category: "Helper",
      rate: "1",
      unit: "HOUR",
    }));
    expect(subcontractorContractSchema.safeParse({ ...VALID, rates }).success).toBe(false);
  });

  it("stores terms one per line, dropping blank lines and stray spaces", () => {
    const parsed = subcontractorContractSchema.parse({
      ...VALID,
      terms: "  First term  \r\n\r\nSecond term\n   \n",
    });
    expect(parsed.terms).toBe("First term\nSecond term");
    expect(subcontractorContractSchema.parse({ ...VALID, terms: " \n " }).terms).toBeUndefined();
  });
});

describe("terms helpers", () => {
  it("splits stored terms into the numbered list", () => {
    expect(splitTerms("a\nb\n\nc")).toEqual(["a", "b", "c"]);
    expect(splitTerms(null)).toEqual([]);
  });

  it("normalises the shared default the same way", () => {
    expect(subcontractDefaultsSchema.parse({ terms: "x\n\n y " }).terms).toBe("x\ny");
  });
});
