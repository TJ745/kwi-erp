import { z } from "zod";

/**
 * The company's two performance forms — "Performance & Development Plan"
 * (staff) and "Performance Appraisal" (workers) — as data: their fixed
 * wording, the shape of what is filled in, and the arithmetic on it.
 */

export const EVALUATION_TEMPLATES = ["STAFF", "WORKER"] as const;
export type EvaluationTemplate = (typeof EVALUATION_TEMPLATES)[number];

export const TEMPLATE_LABELS: Record<EvaluationTemplate, string> = {
  STAFF: "Staff — Performance & Development Plan",
  WORKER: "Worker — Performance Appraisal",
};

// --- Staff ----------------------------------------------------------------------

/** Printed in two columns: the first five on the left, the rest on the right. */
export const STAFF_COMPETENCIES = [
  {
    key: "analytical",
    en: "Analytical Thinking & Decision Making",
    ar: "التفكير التحليلي و إتخاذ القرار",
  },
  { key: "accountability", en: "Accountability & Responsibility", ar: "تحمل المسؤولية" },
  { key: "growth", en: "Capability to Grow Self & Others", ar: "القدرة على النمو و تنمية الآخرين" },
  { key: "leadership", en: "Leadership Qualities", ar: "الكفاءات القيادية" },
  { key: "communication", en: "Communication Skills", ar: "مهارات التواصل" },
  { key: "emotional", en: "Emotional Intelligence", ar: "الذكاء العاطفي" },
  { key: "mastery", en: "Technical & Business Mastery", ar: "التمكن المهني و التقني" },
  {
    key: "selfDrive",
    en: "Self Drive & Action Orientation",
    ar: "التحفيز الذاتي و الرغبة في الإنجاز",
  },
  { key: "discipline", en: "Operating Discipline", ar: "الإنضباط في العمل" },
  { key: "loyalty", en: "Loyalty Values", ar: "قيم الولاء" },
] as const;
export type StaffCompetencyKey = (typeof STAFF_COMPETENCIES)[number]["key"];

export const STAFF_GOAL_ROWS = 5;
export const STAFF_DEVELOPMENT_ROWS = 3;

/** Bilingual labels for the staff form, as printed. */
export const STAFF_TEXT = {
  title: { en: "Performance & Development Plan", ar: "خطة الإنجازات و التطوير" },
  employeeName: { en: "Employee Name", ar: "إسم الموظف" },
  currentPosition: { en: "Current Position", ar: "المنصب الحالي" },
  id: { en: "# ID", ar: "" },
  timeInPosition: { en: "Time in Position", ar: "الوقت في المنصب الحالي" },
  managerName: { en: "Manager Name", ar: "إسم المدير" },
  managerPosition: { en: "Manager's Position", ar: "منصب المدير" },
  pdpStarted: { en: "PDP Started", ar: "تاريخ بداية الخطة" },
  pdpCompleted: { en: "PDP Completed", ar: "تاريخ نهاية الخطة" },
  actionPlan: { en: "Action Plan & Summary of Achievements", ar: "خطة العمل و ملخص الإنجازات" },
  goalsCategory: { en: "Goals Category", ar: "فئة الأهداف" },
  weight: { en: "Weight (0% out of 100%)", ar: "" },
  deliverables: { en: "Key Deliverables & Outcomes", ar: "الأهداف و النتائج الرئيسية" },
  successMeasures: { en: "Action Plan & Success Measures", ar: "خطة العمل و مقاييس النجاح" },
  timeline: { en: "Timeline", ar: "الجدول الزمني" },
  rating: { en: "Rating", ar: "التقييم" },
  results: { en: "Results Achieved", ar: "النتائج المحققة" },
  competencies: {
    en: "Core Competencies Evaluation 1-5 ( 1 poor) 2 ( satisfied ) (3 Good ) ( 4 very good ) ( 5 Excellent )",
    ar: "تقييم الكفاءات الأساسية",
  },
  competency: { en: "Competency", ar: "الكفاءة" },
  comment: { en: "Comment", ar: "التعليق" },
  developmentPlan: { en: "Development Plan", ar: "خطة التطوير" },
  developmentAreas: { en: "Development Areas", ar: "نقاط التطوير" },
  observed: {
    en: "How was this development area observed in the employee's work?",
    ar: "كيف تم ملاحظة نقاط التطوير المذكورة في عمل الموظف؟",
  },
  addressed: {
    en: "How can this development area be addressed and leveraged in the future?",
    ar: "كيف يمكن التعامل مع نقاط التطوير والاستفادة منها في المستقبل؟",
  },
  managerComments: { en: "Manager Comments", ar: "تعليقات المدير" },
  employeeComments: { en: "Employee Comments", ar: "تعليقات الموظف" },
  employeeSignature: { en: "Employee Signature", ar: "توقيع الموظف" },
  managerSignature: { en: "Manager Signature", ar: "توقيع المدير" },
  hrSignature: { en: "HR Signature", ar: "توقيع الموارد البشرية" },
  finalRating: { en: "Final Rating", ar: "التقييم النهائي" },
  date: { en: "Date", ar: "التاريخ" },
} as const;

// --- Worker ---------------------------------------------------------------------

/** Laid out in three columns on the printed sheet, top to bottom. */
export const WORKER_CRITERIA = [
  {
    key: "punctuality",
    column: 1,
    title: "PUNCTUALITY",
    text: "He reports to office or workplace on time",
  },
  {
    key: "initiative",
    column: 1,
    title: "INITIATIVE",
    text: "He automatically approaches his immediate superior and asks if there is any work to be done.",
  },
  {
    key: "fastLearner",
    column: 1,
    title: "FAST LEARNER",
    text: "He can easily understand and has the aptitude to learn the new task assigned to him.",
  },
  {
    key: "productivity",
    column: 2,
    title: "PRODUCTIVITY",
    text: "He successfully finishes the entire task assigned to him on or before the given time.",
  },
  {
    key: "willingness",
    column: 2,
    title: "WILLINGNESS TO LEARN",
    text: "He is willing to learn his job and exert to learn more.",
  },
  {
    key: "integrity",
    column: 2,
    title: "INTEGRITY",
    text: "He knows what is right and wrong and do only what is best to the company.",
  },
  {
    key: "independent",
    column: 2,
    title: "INDEPENDENT",
    text: "He can easily work and finish the task even with less supervision.",
  },
  {
    key: "jobKnowledge",
    column: 3,
    title: "JOB KNOWLEDGE",
    text: "He has enough knowledge on the job that he is performing.",
  },
  {
    key: "cooperation",
    column: 3,
    title: "COOPERATION / RESPECT TO SUPERIORS",
    text: "He is cooperative and shows high respect to his immediate superiors.",
  },
  { key: "loyalty", column: 3, title: "LOYALTY", text: "He shows strong loyalty to the company." },
] as const;
export type WorkerCriterionKey = (typeof WORKER_CRITERIA)[number]["key"];

export const WORKER_SCALE = [
  { label: "Unsatisfactory:", points: "1 – 2 points" },
  { label: "Fair:", points: "3 – 4 points" },
  { label: "Good:", points: "5 – 6 points" },
  { label: "Very good:", points: "7 – 9 points" },
  { label: "Excellent:", points: "10 points" },
] as const;

export const WORKER_INSTRUCTIONS = [
  "Please rate employee’s performance by choosing and typing the numbers from one (1) to ten (10). One (1) is the lowest and Ten (10) is the highest.",
  "Please don’t be bias and be fair when appraising. Each number has its corresponding weight percentage.",
  "At the end of the appraisal period. Please indicate any performance characteristics which needs improvement and what might he can do to improve his job performance.",
] as const;

export const PROGRESS_MARKS = [5, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

// --- Form data --------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max).default("");

/** A rating box: blank, or a whole number in range. */
const rating = (max: number) =>
  z
    .string()
    .trim()
    .default("")
    .refine(
      (v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= max),
      `Use a number from 1 to ${String(max)}`,
    );

const goalRow = z
  .object({
    category: text(200),
    weight: z
      .string()
      .trim()
      .default("")
      .refine(
        (v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) <= 100),
        "Weight is a percentage from 0 to 100",
      ),
    deliverables: text(1000),
    actionPlan: text(2000),
    timeline: text(200),
    /** Typed freely by the evaluator, unlike the 1–5 competency ratings. */
    rating: text(50),
    results: text(2000),
  })
  .strict();

const COMPETENCY_KEYS = STAFF_COMPETENCIES.map((c) => c.key) as [
  StaffCompetencyKey,
  ...StaffCompetencyKey[],
];

const competencyEntry = z.object({ rating: rating(5), comment: text(1000) }).strict();

/** Every competency present, blank when not given. */
const competencies = z
  .partialRecord(z.enum(COMPETENCY_KEYS), competencyEntry)
  .default({})
  .transform(
    (given) =>
      Object.fromEntries(
        COMPETENCY_KEYS.map((k) => [k, given[k] ?? { rating: "", comment: "" }]),
      ) as Record<StaffCompetencyKey, { rating: string; comment: string }>,
  );

export const staffDataSchema = z
  .object({
    goals: z.array(goalRow).max(STAFF_GOAL_ROWS).default([]),
    competencies,
    development: z
      .array(z.object({ area: text(300), observed: text(2000), addressed: text(2000) }).strict())
      .max(STAFF_DEVELOPMENT_ROWS)
      .default([]),
  })
  .strict()
  .superRefine((d, ctx) => {
    const total = d.goals.reduce((sum, g) => sum + (g.weight === "" ? 0 : Number(g.weight)), 0);
    if (total > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["goals"],
        message: `Goal weights add up to ${String(total)}% — at most 100%`,
      });
    }
  });
export type StaffData = z.infer<typeof staffDataSchema>;

const CRITERION_KEYS = WORKER_CRITERIA.map((c) => c.key) as [
  WorkerCriterionKey,
  ...WorkerCriterionKey[],
];

export const workerDataSchema = z
  .object({
    scores: z
      .partialRecord(z.enum(CRITERION_KEYS), rating(10))
      .default({})
      .transform(
        (given) =>
          Object.fromEntries(CRITERION_KEYS.map((k) => [k, given[k] ?? ""])) as Record<
            WorkerCriterionKey,
            string
          >,
      ),
  })
  .strict();
export type WorkerData = z.infer<typeof workerDataSchema>;

export function emptyStaffData(): StaffData {
  return staffDataSchema.parse({});
}

export function emptyWorkerData(): WorkerData {
  return workerDataSchema.parse({});
}

/** Reads stored JSON leniently: anything malformed falls back to blank. */
export function readStaffData(raw: unknown): StaffData {
  const parsed = staffDataSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyStaffData();
}

export function readWorkerData(raw: unknown): WorkerData {
  const parsed = workerDataSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyWorkerData();
}

// --- Arithmetic -------------------------------------------------------------------

/** Worker result: the ten scores added up, out of 100. Null until one is given. */
export function workerResult(data: WorkerData): number | null {
  const given = WORKER_CRITERIA.map((c) => data.scores[c.key]).filter((v) => v !== "");
  if (given.length === 0) return null;
  return given.reduce((sum, v) => sum + Number(v), 0);
}

/** Which marks of the progress meter a result fills: every mark at or below it. */
export function progressMarksReached(result: number | null): number {
  if (result === null) return 0;
  return PROGRESS_MARKS.filter((m) => m <= result).length;
}

/**
 * The Performance Result Summary: four boxes splitting 0–100% into equal
 * bands. The result is written in the box its percentage falls in.
 */
export const SUMMARY_BOXES = [
  { box: 1, label: "1st", upTo: 25 },
  { box: 2, label: "2nd", upTo: 50 },
  { box: 3, label: "3rd", upTo: 75 },
  { box: 4, label: "4th", upTo: 100 },
] as const;

export function summaryBoxOf(result: number | null): 1 | 2 | 3 | 4 | null {
  if (result === null) return null;
  return (SUMMARY_BOXES.find((b) => result <= b.upTo) ?? SUMMARY_BOXES[3]).box;
}

/**
 * A suggested final rating for the staff form, on the 1–5 scale: goals by
 * weight (rated goals only) and the competency average, averaged. Only a
 * suggestion — the evaluator types the final rating.
 */
export function staffSuggestion(data: StaffData): {
  goals: number | null;
  competencies: number | null;
  overall: number | null;
} {
  // Goal ratings are typed freely ("4", "4.5", "Exceeded"); only numbers can
  // take part in the suggestion.
  const rated = data.goals.filter(
    (g) => /^\d+(\.\d+)?$/.test(g.rating) && g.weight !== "" && Number(g.weight) > 0,
  );
  const weightSum = rated.reduce((s, g) => s + Number(g.weight), 0);
  const goals =
    weightSum > 0
      ? rated.reduce((s, g) => s + Number(g.weight) * Number(g.rating), 0) / weightSum
      : null;

  const comps = STAFF_COMPETENCIES.map((c) => data.competencies[c.key].rating).filter(
    (r) => r !== "",
  );
  const competencies = comps.length
    ? comps.reduce((s, r) => s + Number(r), 0) / comps.length
    : null;

  const parts = [goals, competencies].filter((v): v is number => v !== null);
  const overall = parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : null;
  const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
  return { goals: round(goals), competencies: round(competencies), overall: round(overall) };
}

/** "2 years 3 months" between joining and the evaluation date. */
export function timeBetween(from: Date, to: Date): string {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  if (months < 0) return "";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years ? `${String(years)} year${years === 1 ? "" : "s"}` : "",
    rest ? `${String(rest)} month${rest === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "Less than a month";
}
