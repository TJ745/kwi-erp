/**
 * The fixed parts of the recruitment and joining/leaving forms, after the
 * company's own: Personnel Requirement Request (FM:AP:002), Interview
 * Evaluation Report (FM:AP:006), New Appointment Acknowledgment (FM:AP:034)
 * and the Employee Clearance Form.
 *
 * Pure data, shared by the forms, the validation and the printed pages.
 */

export const FORM_CODES = {
  prr: ["FM:AP:002", "Rev. 4, 21/10/12"],
  interview: ["FM:AP:006", "(Rev. 3, 28/04/012"],
  joining: ["FM:AP:034", "(Rev. 0, 15/04/03)"],
} as const;

// --- Personnel Requirement Request ------------------------------------------

export const PRR_PURPOSES = ["NEW", "ADDITIONAL", "REPLACEMENT"] as const;
export const EDUCATION_LEVELS = ["UNIVERSITY", "DIPLOMA", "VOCATIONAL"] as const;
export const EDUCATION_LABELS: Record<(typeof EDUCATION_LEVELS)[number], string> = {
  UNIVERSITY: "University",
  DIPLOMA: "Institute/Diploma",
  VOCATIONAL: "Vocational",
};
export const LANGUAGES = ["ARABIC", "ENGLISH", "BOTH"] as const;
export const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  ARABIC: "Arabic",
  ENGLISH: "English",
  BOTH: "Both",
};
export const SOURCING = ["INTERNAL", "EXTERNAL"] as const;
export const EXTERNAL_SOURCES = ["LOCAL", "OVERSEAS", "MANPOWER"] as const;
export const EXTERNAL_LABELS: Record<(typeof EXTERNAL_SOURCES)[number], string> = {
  LOCAL: "Local",
  OVERSEAS: "Overseas",
  MANPOWER: "Manpower Supply",
};

/** "PRR-KWI-26-001": per company, per year. */
export function formatPrrNo(companyCode: string, year: number, n: number): string {
  return `PRR-${companyCode}-${String(year % 100).padStart(2, "0")}-${String(n).padStart(3, "0")}`;
}

// --- Interview Evaluation Report --------------------------------------------

export type InterviewRow = {
  key: string;
  label: string;
  /** 0 = numbered factor, 1 = a./b., 2 = * item, 3 = - sub-item. */
  indent: 0 | 1 | 2 | 3;
};

/** I. Preliminary interview, as on the form. */
export const PRELIMINARY_ROWS: readonly InterviewRow[] = [
  { key: "education", label: "1. Education", indent: 0 },
  { key: "experience", label: "2. Experience", indent: 0 },
  { key: "expFields", label: "a. Fields", indent: 1 },
  { key: "expYears", label: "b. No. of Years", indent: 1 },
  { key: "knowledge", label: "3. Basic Knowledge", indent: 0 },
  { key: "skills", label: "4. Skills", indent: 0 },
  { key: "linguistic", label: "a. Linguistic", indent: 1 },
  { key: "computer", label: "b. Computer", indent: 1 },
  { key: "word", label: "* Word", indent: 2 },
  { key: "excel", label: "* Excel", indent: 2 },
  { key: "autocad", label: "* AutoCAD", indent: 2 },
  { key: "cad2d", label: "- 2D", indent: 3 },
  { key: "cad3d", label: "- 3D", indent: 3 },
  { key: "otherSoftware", label: "* Others", indent: 2 },
  { key: "driving", label: "c. Driving", indent: 1 },
  { key: "special", label: "d. Special", indent: 1 },
  { key: "impression", label: "5. Overall Impression", indent: 0 },
  { key: "fluid", label: "a. Fluid Intelligence", indent: 1 },
  { key: "socio", label: "b. Socio-emotional profile", indent: 1 },
  { key: "aptitude", label: "c. Work Aptitude and Attitude", indent: 1 },
];

/** II. Second interview (section/branch/department/division head). */
export const SECOND_ROWS: readonly InterviewRow[] = [
  { key: "technical", label: "1. Technical Skills and Knowledge", indent: 0 },
  { key: "estimation", label: "* Estimation", indent: 2 },
  { key: "designing", label: "* Designing", indent: 2 },
  { key: "drafting", label: "* Drafting/Detailing", indent: 2 },
  { key: "projectManagement", label: "* Project Management", indent: 2 },
];

export const INTERVIEW_ROW_KEYS = [...PRELIMINARY_ROWS, ...SECOND_ROWS].map((r) => r.key);

export const RECOMMENDATIONS = ["HIGH", "MODERATE", "HELD", "NOT"] as const;
export const RECOMMENDATION_LABELS: Record<(typeof RECOMMENDATIONS)[number], string> = {
  HIGH: "Highly Recommended (Risk: 10%)",
  MODERATE: "Moderately Recommended (Risk: 40%)",
  HELD: "Held for Comparison (Risk: 60%)",
  NOT: "Not Recommended (Risk: 90%)",
};
export const FINAL_ACTIONS = ["APPROVED", "DISAPPROVED"] as const;
export const FINAL_ACTION_LABELS: Record<(typeof FINAL_ACTIONS)[number], string> = {
  APPROVED: "Approved for Hiring",
  DISAPPROVED: "Disapproved for Hiring",
};

/** What a PRR puts in the "Personnel Requirement Request" column. */
export function requiredFromPrr(prr: {
  educationRequired: readonly string[];
  specialization: string;
  experienceFields: string;
  yearsMin: string;
  language: string;
  skills: string;
}): Record<string, string> {
  const education =
    prr.specialization ||
    prr.educationRequired
      .map((e) => EDUCATION_LABELS[e as keyof typeof EDUCATION_LABELS] ?? e)
      .join(" / ");
  const linguistic =
    prr.language === "BOTH"
      ? "Arabic, English"
      : prr.language
        ? (LANGUAGE_LABELS[prr.language as keyof typeof LANGUAGE_LABELS] ?? "")
        : "";
  return {
    education,
    expFields: prr.experienceFields,
    expYears: prr.yearsMin ? `Min. ${prr.yearsMin}` : "",
    linguistic,
    skills: prr.skills,
  };
}

// --- Joining letter -----------------------------------------------------------

/** "02nd February 2026" — the ordinal as the form prints it (sup in print). */
export function ordinalParts(date: Date): { day: string; suffix: string; rest: string } {
  const d = date.getUTCDate();
  const suffix =
    d % 10 === 1 && d !== 11
      ? "st"
      : d % 10 === 2 && d !== 12
        ? "nd"
        : d % 10 === 3 && d !== 13
          ? "rd"
          : "th";
  const rest = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return { day: String(d).padStart(2, "0"), suffix, rest };
}

// --- Clearance form -----------------------------------------------------------

/** A clearance line: the item, and (on the signed sections) who clears it. */
export type ClearanceLine = { key: string; en: string; ar: string; named: boolean };

export const CLEARANCE_SECTIONS = [
  {
    key: "it",
    en: "IT DEPARTMENT",
    ar: "قسم تكنولوجيا المعلومات",
    signerEn: "IT Manager",
    signerAr: "مدير تقنية المعلومات",
    lines: [
      { key: "serverUser", en: "Server user name", ar: "اسم المستخدم على السيرفر", named: false },
      { key: "email", en: "Email Account", ar: "البريد الإلكتروني", named: false },
      { key: "erp", en: "ERP Account", ar: "حساب ERP", named: false },
      { key: "hardware", en: "Hardware and Devices", ar: "الكمبيوترات والأجهزه", named: false },
      { key: "software", en: "Software", ar: "البرامج", named: false },
    ],
  },
  {
    key: "direct",
    en: "DIRECT DEPARTMENT",
    ar: "القسم المباشر",
    signerEn: "Department Manager",
    signerAr: "مدير القسم",
    lines: [
      {
        key: "accessCards",
        en: "Aramco and Gov. Access Cards",
        ar: "بطاقة دخول أرامكو والشركات",
        named: true,
      },
      { key: "warehouse", en: "Warehouse", ar: "المستودع", named: true },
      { key: "supervisor", en: "Direct Supervisor", ar: "المسؤول المباشر", named: true },
    ],
  },
  {
    key: "hr",
    en: "HR DEPARTMENT",
    ar: "قسم شؤون الموظفين",
    signerEn: "HR Manager",
    signerAr: "مدير الموارد البشرية",
    lines: [
      { key: "idCard", en: "ID Access Card", ar: "بطاقة الدخول", named: true },
      { key: "cars", en: "Cars", ar: "السيارات", named: true },
      { key: "sim", en: "Sim Card and Mobile", ar: "الشريحة و الجوال", named: true },
      { key: "accommodation", en: "Accommodation Officer", ar: "مسؤول السكن", named: true },
    ],
  },
  {
    key: "finance",
    en: "Finance & Accounts Department",
    ar: "قسم المالية و المحاسبة",
    signerEn: "Finance Manager",
    signerAr: "مدير قسم المالية",
    lines: [{ key: "finance", en: "Finance & Accounts", ar: "المالية و الحسابات", named: true }],
  },
] as const satisfies readonly {
  key: string;
  en: string;
  ar: string;
  signerEn: string;
  signerAr: string;
  lines: readonly ClearanceLine[];
}[];

export const CLEARANCE_LINE_KEYS = CLEARANCE_SECTIONS.flatMap((s) => s.lines.map((l) => l.key));
export const CLEARANCE_SIGNER_KEYS = CLEARANCE_SECTIONS.map((s) => s.key);
