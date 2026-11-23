import { describe, expect, it } from "vitest";
import {
  CLEARANCE_LINE_KEYS,
  INTERVIEW_ROW_KEYS,
  formatPrrNo,
  ordinalParts,
  requiredFromPrr,
} from "./recruitment-forms";
import {
  clearanceSchema,
  interviewSchema,
  joiningLetterSchema,
  prrSchema,
} from "./schemas/recruitment";

describe("recruitment forms", () => {
  it("numbers a PRR per company and year", () => {
    expect(formatPrrNo("KWI", 2026, 1)).toBe("PRR-KWI-26-001");
    expect(formatPrrNo("ACC", 2027, 42)).toBe("PRR-ACC-27-042");
  });

  it("prints joining dates like the form: 02nd February 2026", () => {
    expect(ordinalParts(new Date("2026-02-02"))).toEqual({
      day: "02",
      suffix: "nd",
      rest: "February 2026",
    });
    expect(ordinalParts(new Date("2026-03-11")).suffix).toBe("th");
    expect(ordinalParts(new Date("2026-03-21")).suffix).toBe("st");
    expect(ordinalParts(new Date("2026-03-23")).suffix).toBe("rd");
  });

  it("fills the interview's PRR column from the request", () => {
    expect(
      requiredFromPrr({
        educationRequired: ["UNIVERSITY"],
        specialization: "Bachelors in Business Administration",
        experienceFields: "Sales Manager",
        yearsMin: "5 Years",
        language: "BOTH",
        skills: "",
      }),
    ).toEqual({
      education: "Bachelors in Business Administration",
      expFields: "Sales Manager",
      expYears: "Min. 5 Years",
      linguistic: "Arabic, English",
      skills: "",
    });
    expect(
      requiredFromPrr({
        educationRequired: ["UNIVERSITY", "DIPLOMA"],
        specialization: "",
        experienceFields: "",
        yearsMin: "",
        language: "",
        skills: "",
      }).education,
    ).toBe("University / Institute/Diploma");
  });

  it("has every row of the interview form", () => {
    expect(INTERVIEW_ROW_KEYS).toHaveLength(25);
    expect(new Set(INTERVIEW_ROW_KEYS).size).toBe(25);
  });

  it("validates a PRR, filling blanks with empty text", () => {
    const parsed = prrSchema.parse({
      companyId: "c1",
      requestDate: "2026-02-01",
      jobTitle: "Sales Manager",
      vacancies: "1",
      details: { purpose: "NEW", educationRequired: ["UNIVERSITY"], language: "BOTH" },
    });
    expect(parsed.details.section).toBe("");
    expect(parsed.positionId).toBeNull();
    expect(parsed.prrNo).toBeUndefined();
    expect(
      prrSchema.safeParse({
        companyId: "c1",
        requestDate: "2026-02-01",
        jobTitle: "Sales Manager",
        vacancies: "1",
        details: { purpose: "SOMETHING" },
      }).success,
    ).toBe(false);
    expect(
      prrSchema.safeParse({
        companyId: "c1",
        requestDate: "2026-02-01",
        jobTitle: "Sales Manager",
        vacancies: "1",
        details: { unknown: "x" },
      }).success,
    ).toBe(false);
  });

  it("validates an interview's rows", () => {
    const base = {
      companyId: "c1",
      applicantName: "Haitham",
      positionTitle: "Sales Manager",
      interviewDate: "2026-01-20",
    };
    const ok = interviewSchema.parse({
      ...base,
      details: { rows: { education: { required: "BBA", actual: "BBA", met: "MET" } } },
    });
    expect(ok.details.rows.education?.met).toBe("MET");
    expect(
      interviewSchema.safeParse({
        ...base,
        details: { rows: { madeUp: { required: "", actual: "", met: "" } } },
      }).success,
    ).toBe(false);
  });

  it("validates joining letters and clearance forms", () => {
    expect(
      joiningLetterSchema.parse({
        employeeId: "e1",
        letterDate: "2026-02-02",
        joiningDate: "2026-02-02",
        remarks: "",
      }).remarks,
    ).toBeNull();
    const c = clearanceSchema.parse({
      employeeId: "e1",
      formDate: "2026-10-22",
      endDate: "",
      details: { lines: { hardware: { value: "N/A", name: "" } }, signers: { direct: "Naser" } },
    });
    expect(c.endDate).toBeNull();
    expect(CLEARANCE_LINE_KEYS).toContain("hardware");
  });
});
