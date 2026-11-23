/**
 * The employment offer letter: the choices each term allows, and the wording
 * each choice prints as. Only these choices exist, so the printed clauses are
 * always one of a known set.
 */

export const SALUTATIONS = ["Mr.", "Ms."] as const;
export const ID_TYPES = ["PASSPORT", "IQAMA"] as const;
export const ID_TYPE_LABELS: Record<(typeof ID_TYPES)[number], string> = {
  PASSPORT: "Passport #",
  IQAMA: "Iqama #",
};

export const CONTRACT_YEARS = [1, 2] as const;
export const PROBATION_DAYS = [90, 180] as const;
export const FAMILY_STATUSES = ["WITHOUT_FAMILY", "WITH_FAMILY"] as const;
export const LEAVE_PLANS = ["30_AFTER_1Y", "42_AFTER_2Y"] as const;
export const COVERS = ["SELF", "SELF_FAMILY"] as const;

export const TERM_OPTION_LABELS = {
  contractYears: { 1: "1 year", 2: "2 years" },
  probationDays: { 90: "90 days", 180: "180 days" },
  familyStatus: { WITHOUT_FAMILY: "Without family", WITH_FAMILY: "With family" },
  leavePlan: { "30_AFTER_1Y": "30 days after 1 year", "42_AFTER_2Y": "42 days after 2 years" },
  cover: { SELF: "Self", SELF_FAMILY: "Self + family" },
} as const;

export type OfferTerms = {
  companyCode: string;
  contractYears: number;
  probationDays: number;
  familyStatus: string;
  leavePlan: string;
  ticketCover: string;
  ticketDestination: string | null;
  medicalCover: string;
};

/** The months of service a leave (and its ticket) is earned over. */
const leaveMonths = (plan: string) => (plan === "42_AFTER_2Y" ? 24 : 12);

/** Clauses 06 onwards of the letter, numbered by the caller. */
export function offerClauses(t: OfferTerms): { label: string; lines: string[] }[] {
  const months = leaveMonths(t.leavePlan);
  const destination = t.ticketDestination?.trim() || "the home country";
  const years = t.contractYears === 2 ? "2 Years - 24" : "1 Year - 12";

  return [
    {
      label: "Contract Duration",
      lines: [
        `${years} Gregorian Months. Mutually renewable between the employer and the employee.`,
        "A Standard company contract upon joining the duty has to be signed by the employee which confirms with the salary and entitled benefits.",
        "The Contract will be effective from the date of joining the duty.",
      ],
    },
    {
      label: "Location",
      lines: [
        `You may be required to work with ${t.companyCode} or our affiliates in the Kingdom of Saudi Arabia as desired by the company.`,
      ],
    },
    {
      label: "Probation Period",
      lines: [
        `${String(t.probationDays === 180 ? 180 : 90)} Days - The employer can terminate the labor contract during this period, according to Saudi Labor Law.`,
      ],
    },
    {
      label: "Employment Status",
      lines: [t.familyStatus === "WITH_FAMILY" ? "With Family Status." : "Without Family Status."],
    },
    {
      label: "Leave Entitlement",
      lines: [
        t.leavePlan === "42_AFTER_2Y"
          ? "42 Days paid leave, to be taken after the completion of 24 calendar months of continuous service."
          : "30 Days paid leave, to be taken after the completion of 12 calendar month of continuous service.",
      ],
    },
    {
      label: "Vacation Ticket",
      lines: [
        t.ticketCover === "SELF_FAMILY"
          ? `Self and family economy/excursion shortest route return air tickets from Riyadh to ${destination} once every ${String(months)} Months, if the dependents are under employee sponsorship.`
          : `One Self economy/excursion shortest route return air ticket from Riyadh to ${destination} once every ${String(months)} Months.`,
      ],
    },
    {
      label: "Medical Insurance",
      lines: [
        t.medicalCover === "SELF_FAMILY"
          ? "Provided to Employee and family according to company medical insurance policy, if the dependents are under employee sponsorship."
          : "Provided to Employee according to company medical insurance policy.",
      ],
    },
    {
      label: "Working Hours",
      lines: ["The normal working hours are 48 hours per week according to Saudi Labor Law."],
    },
    { label: "Region Coverage", lines: ["All Saudi Regions as per work requirements."] },
  ];
}

export const SALARY_LINES = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "housingAllowance", label: "Housing Allowance" },
  { key: "transportAllowance", label: "Transportation Allow." },
  { key: "mobileAllowance", label: "Mobile Allowance" },
] as const;
export type SalaryLineKey = (typeof SALARY_LINES)[number]["key"];

/** Sum of the given parts in halalas, so decimals never drift; null if none given. */
export function offerTotal(
  parts: Partial<Record<SalaryLineKey, string | null | undefined>>,
): string | null {
  const given = SALARY_LINES.map((l) => parts[l.key]).filter(
    (v): v is string => v !== null && v !== undefined && v !== "",
  );
  if (given.length === 0) return null;
  const minor = given.reduce((sum, v) => sum + Math.round(Number(v) * 100), 0);
  return (minor / 100).toFixed(2);
}

/** "1-Jun-2026", as on the letter. */
export function offerDateLabel(d: Date): string {
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${String(d.getUTCDate())}-${month}-${String(d.getUTCFullYear())}`;
}
