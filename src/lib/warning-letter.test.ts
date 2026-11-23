import { describe, expect, it } from "vitest";
import { LETTER_TEXT, matchReason, OTHER_REASON, WARNING_REASONS } from "./warning-letter";
import { warningSchema } from "./schemas/hr-records";

const VALID = {
  employeeId: "e1",
  level: "FIRST_WRITTEN",
  reason: "Absent from job site without informing manager",
  description: "It has come to our attention that you are absent from job site.",
  descriptionAr: "لقد علمنا أنك غائب عن موقع العمل.",
  issuedDate: "2025-05-26",
};

describe("ready-made warning reasons", () => {
  it("every reason has a label and both languages", () => {
    for (const r of WARNING_REASONS) {
      expect(r.label.length, r.key).toBeGreaterThan(3);
      expect(r.en.length, r.key).toBeGreaterThan(20);
      // The Arabic text really is Arabic.
      expect(/[؀-ۿ]/.test(r.ar), r.key).toBe(true);
    }
  });

  it("keys are unique and never collide with Other", () => {
    const keys = WARNING_REASONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(OTHER_REASON);
  });

  it("recognises a saved letter that still uses a preset's wording", () => {
    const preset = WARNING_REASONS[0]!;
    expect(matchReason(preset.label, preset.en)?.key).toBe(preset.key);
    // Edited wording is treated as a custom (Other) letter.
    expect(matchReason(preset.label, `${preset.en} Extra.`)).toBeUndefined();
  });
});

describe("letter wording", () => {
  it("addresses men and women correctly in both languages", () => {
    expect(LETTER_TEXT.en.dear("Abdulrahman Ansari", false)).toBe("Dear Mr. Abdulrahman Ansari,");
    expect(LETTER_TEXT.en.dear("Sara Ali", true)).toBe("Dear Ms. Sara Ali,");
    expect(LETTER_TEXT.ar.dear("عبدالرحمن", false)).toContain("عزيزي السيد");
    expect(LETTER_TEXT.ar.dear("سارة", true)).toContain("عزيزتي السيدة");
  });
});

describe("warning schema", () => {
  it("accepts a letter with English and Arabic text", () => {
    expect(warningSchema.safeParse(VALID).success).toBe(true);
    expect(warningSchema.safeParse({ ...VALID, project: "Al-Yamama Project" }).success).toBe(true);
  });

  it("requires the Arabic text", () => {
    const result = warningSchema.safeParse({ ...VALID, descriptionAr: "" });
    expect(result.success).toBe(false);
  });

  it("treats a blank project as none", () => {
    const parsed = warningSchema.parse({ ...VALID, project: "" });
    expect(parsed.project).toBeUndefined();
  });
});
