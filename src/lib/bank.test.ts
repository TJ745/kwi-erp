import { describe, expect, it } from "vitest";
import { describeIbanProblem, maskIban, normaliseIban, validateIban } from "./bank";

/**
 * The positive cases come first and are asserted to pass, so a change that
 * broke validation outright could not make the negative cases look correct.
 */

// Real-format IBANs with valid checksums (published ISO examples, not
// anyone's account).
const VALID = {
  SA: "SA0380000000608010167519",
  GB: "GB82WEST12345698765432",
  AE: "AE070331234567890123456",
  KW: "KW81CBKU0000000000001234560101",
};

describe("validateIban — accepts", () => {
  it.each(Object.entries(VALID))("a valid %s IBAN", (_country, iban) => {
    const result = validateIban(iban);
    expect(result.ok).toBe(true);
  });

  it("accepts the spaces people paste from a bank statement", () => {
    const spaced = "SA03 8000 0000 6080 1016 7519";
    const result = validateIban(spaced);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.iban).toBe(VALID.SA);
  });

  it("accepts lowercase and normalises it", () => {
    const result = validateIban(VALID.SA.toLowerCase());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.iban).toBe(VALID.SA);
  });
});

describe("validateIban — rejects", () => {
  it("an empty value", () => {
    expect(validateIban("")).toEqual({ ok: false, problem: "EMPTY" });
    expect(validateIban("   ")).toEqual({ ok: false, problem: "EMPTY" });
  });

  it("something that is not shaped like an IBAN", () => {
    expect(validateIban("not-an-iban")).toEqual({ ok: false, problem: "FORMAT" });
    expect(validateIban("1234567890123456")).toEqual({ ok: false, problem: "FORMAT" });
    // Letters where the check digits belong.
    expect(validateIban("SAAB80000000608010167519")).toEqual({
      ok: false,
      problem: "FORMAT",
    });
  });

  it("the wrong length for the country", () => {
    expect(validateIban("SA038000000060801016751")).toEqual({
      ok: false,
      problem: "LENGTH",
    });
    expect(validateIban(`${VALID.SA}9`)).toEqual({ ok: false, problem: "LENGTH" });
  });

  it("a country that does not use IBANs", () => {
    // Right shape, right checksum arithmetic path, wrong idea entirely.
    expect(validateIban("US64SVBKUS6S3300958879")).toEqual({
      ok: false,
      problem: "COUNTRY_HAS_NO_IBAN",
    });
  });

  it("a single transposed character — the typo this exists to catch", () => {
    // Swap two digits in an otherwise valid IBAN: length and format still fine,
    // only the checksum gives it away.
    const swapped = "SA0380000000608010165719";
    expect(swapped.length).toBe(VALID.SA.length);
    expect(validateIban(swapped)).toEqual({ ok: false, problem: "CHECKSUM" });
  });

  it("a changed check digit", () => {
    const tampered = `SA04${VALID.SA.slice(4)}`;
    expect(validateIban(tampered)).toEqual({ ok: false, problem: "CHECKSUM" });
  });
});

describe("normaliseIban", () => {
  it("strips spaces and hyphens and upper-cases", () => {
    expect(normaliseIban(" sa03-8000 0000 ")).toBe("SA0380000000");
  });
});

describe("maskIban", () => {
  it("keeps the country and the last four characters", () => {
    const masked = maskIban(VALID.SA);
    expect(masked.startsWith("SA")).toBe(true);
    expect(masked.endsWith("7519")).toBe(true);
    expect(masked).not.toContain("80000000608010");
    expect(masked).toHaveLength(VALID.SA.length);
  });

  it("does not crash on a short value", () => {
    expect(maskIban("SA03")).toBe("SA03");
    expect(maskIban("")).toBe("");
  });
});

describe("describeIbanProblem", () => {
  it("gives an actionable message for every problem", () => {
    const problems = [
      "EMPTY",
      "FORMAT",
      "LENGTH",
      "CHECKSUM",
      "COUNTRY_HAS_NO_IBAN",
    ] as const;

    for (const problem of problems) {
      const message = describeIbanProblem(problem);
      expect(message.length).toBeGreaterThan(10);
      // "Invalid IBAN" tells the user nothing they did not already know.
      expect(message.toLowerCase()).not.toBe("invalid iban");
    }
  });
});
