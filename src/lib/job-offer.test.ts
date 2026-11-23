import { describe, expect, it } from "vitest";
import { offerClauses, offerDateLabel, offerTotal, type OfferTerms } from "./job-offer";
import { jobOfferSchema } from "./schemas/hiring";

const base: OfferTerms = {
  companyCode: "KWI",
  contractYears: 1,
  probationDays: 180,
  familyStatus: "WITHOUT_FAMILY",
  leavePlan: "30_AFTER_1Y",
  ticketCover: "SELF",
  ticketDestination: "Amman",
  medicalCover: "SELF",
};

const clause = (t: OfferTerms, label: string) =>
  offerClauses(t)
    .find((c) => c.label === label)
    ?.lines.join(" ") ?? "";

describe("employment offer clauses", () => {
  it("prints the sample letter's terms", () => {
    expect(clause(base, "Contract Duration")).toContain("1 Year - 12 Gregorian Months");
    expect(clause(base, "Probation Period")).toMatch(/^180 Days - /);
    expect(clause(base, "Employment Status")).toBe("Without Family Status.");
    expect(clause(base, "Leave Entitlement")).toContain("30 Days paid leave");
    expect(clause(base, "Vacation Ticket")).toBe(
      "One Self economy/excursion shortest route return air ticket from Riyadh to Amman once every 12 Months.",
    );
    expect(clause(base, "Location")).toContain("work with KWI or our affiliates");
    expect(offerClauses(base).map((c) => c.label)).toHaveLength(9);
  });

  it("follows each choice", () => {
    const t: OfferTerms = {
      ...base,
      contractYears: 2,
      probationDays: 90,
      familyStatus: "WITH_FAMILY",
      leavePlan: "42_AFTER_2Y",
      ticketCover: "SELF_FAMILY",
      medicalCover: "SELF_FAMILY",
    };
    expect(clause(t, "Contract Duration")).toContain("2 Years - 24 Gregorian Months");
    expect(clause(t, "Probation Period")).toMatch(/^90 Days - /);
    expect(clause(t, "Employment Status")).toBe("With Family Status.");
    expect(clause(t, "Leave Entitlement")).toContain("42 Days paid leave");
    expect(clause(t, "Leave Entitlement")).toContain("24 calendar months");
    // The ticket follows the leave cycle.
    expect(clause(t, "Vacation Ticket")).toContain("Self and family");
    expect(clause(t, "Vacation Ticket")).toContain("once every 24 Months");
    expect(clause(t, "Medical Insurance")).toContain("Employee and family");
  });
});

describe("offer figures", () => {
  it("totals the package like the sample letter", () => {
    expect(
      offerTotal({
        basicSalary: "9480",
        housingAllowance: "2370",
        transportAllowance: "950",
        mobileAllowance: "200",
      }),
    ).toBe("13000.00");
    expect(offerTotal({ basicSalary: "0.1", mobileAllowance: "0.2" })).toBe("0.30");
    expect(offerTotal({})).toBeNull();
  });

  it("formats the date as on the letter", () => {
    expect(offerDateLabel(new Date("2026-06-01"))).toBe("1-Jun-2026");
  });

  it("only accepts the offered choices", () => {
    const ok = { companyId: "c1", candidateName: "Ayman Shoman", status: "DRAFT" };
    expect(jobOfferSchema.safeParse(ok).success).toBe(true);
    expect(jobOfferSchema.safeParse({ ...ok, contractYears: "3" }).success).toBe(false);
    expect(jobOfferSchema.safeParse({ ...ok, probationDays: "60" }).success).toBe(false);
    expect(jobOfferSchema.safeParse({ ...ok, ticketCover: "FAMILY_ONLY" }).success).toBe(false);
    expect(jobOfferSchema.safeParse({ ...ok, candidateIdType: "LICENCE" }).success).toBe(false);
  });
});
