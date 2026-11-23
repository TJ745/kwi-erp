import { z } from "zod";
import {
  CLEARANCE_LINE_KEYS,
  CLEARANCE_SIGNER_KEYS,
  EDUCATION_LEVELS,
  EXTERNAL_SOURCES,
  FINAL_ACTIONS,
  INTERVIEW_ROW_KEYS,
  LANGUAGES,
  PRR_PURPOSES,
  RECOMMENDATIONS,
  SOURCING,
} from "@/lib/recruitment-forms";

/**
 * Personnel requests, interview evaluations, joining letters and clearance
 * forms. A blank form field is stored as "" so a printed form never shows
 * "undefined".
 */

const text = (max: number) => z.string().trim().max(max).default("");
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).default("");
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));
const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Enter a valid date");

export const idSchema = z.object({ id: z.string().min(1) }).strict();

// --- Personnel Requirement Request -------------------------------------------

export const prrDetailsSchema = z
  .object({
    section: text(100),
    divisionDepartment: text(150),
    dateNeeded: text(40),
    purpose: choice(PRR_PURPOSES),
    replacementOf: text(150),
    hrRemarks: text(300),
    educationRequired: z.array(z.enum(EDUCATION_LEVELS)).default([]),
    educationPreferable: z.array(z.enum(EDUCATION_LEVELS)).default([]),
    specialization: text(200),
    experienceFields: text(200),
    yearsMin: text(40),
    yearsMax: text(40),
    skills: text(300),
    language: choice(LANGUAGES),
    sourcing: choice(SOURCING),
    externalSource: choice(EXTERNAL_SOURCES),
    justification: text(1500),
    manpowerBudget: text(20),
    manpowerHeadcount: text(20),
    manpowerProjected: text(20),
    manpowerRequested: text(20),
    manpowerRemarks: text(60),
  })
  .strict();

export type PrrDetails = z.infer<typeof prrDetailsSchema>;

export const prrSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    prrNo: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? v : undefined)),
    requestDate: requiredDate,
    positionId: optionalId,
    departmentId: optionalId,
    jobTitle: z.string().trim().min(2, "Job title is required").max(150),
    vacancies: z.coerce.number().int().min(1, "At least 1").max(500),
    details: prrDetailsSchema,
  })
  .strict();

export const updatePrrSchema = prrSchema.extend({ id: z.string().min(1) });
export type PrrInput = z.infer<typeof prrSchema>;

// --- Interview Evaluation Report ---------------------------------------------

const interviewLine = z
  .object({
    required: text(150),
    actual: text(150),
    met: choice(["MET", "UNMET"] as const),
  })
  .strict();

export type InterviewLine = z.infer<typeof interviewLine>;

export const interviewDetailsSchema = z
  .object({
    section: text(100),
    department: text(150),
    nationality: text(60),
    yearsInKsa: text(20),
    professionInIqama: text(100),
    transferable: choice(["TRANSFERABLE", "NON_TRANSFERABLE"] as const),
    availableFor: text(60),
    sourcing: choice(SOURCING),
    externalSource: choice(["LOCAL", "OVERSEAS"] as const),
    rows: z
      .partialRecord(z.enum(INTERVIEW_ROW_KEYS as [string, ...string[]]), interviewLine)
      .default({}),
    assessment: text(1500),
    hrAction: choice(RECOMMENDATIONS),
    secondAssessment: text(1500),
    deptAction: choice(RECOMMENDATIONS),
    finalAction: choice(FINAL_ACTIONS),
  })
  .strict();

export type InterviewDetails = z.infer<typeof interviewDetailsSchema>;

export const interviewSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    prrId: optionalId,
    applicantName: z.string().trim().min(2, "Applicant name is required").max(150),
    positionTitle: z.string().trim().min(2, "Position is required").max(150),
    interviewDate: requiredDate,
    details: interviewDetailsSchema,
  })
  .strict();

export const updateInterviewSchema = interviewSchema.extend({ id: z.string().min(1) });
export type InterviewInput = z.infer<typeof interviewSchema>;

// --- Joining letter -----------------------------------------------------------

export const joiningLetterSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    letterDate: requiredDate,
    joiningDate: requiredDate,
    positionTitle: z.string().trim().max(150).default(""),
    section: z.string().trim().max(100).default(""),
    remarks: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .strict();

export const updateJoiningLetterSchema = joiningLetterSchema.extend({ id: z.string().min(1) });
export type JoiningLetterInput = z.infer<typeof joiningLetterSchema>;

// --- Clearance form -------------------------------------------------------------

const clearanceLine = z.object({ value: text(300), name: text(100) }).strict();

export const clearanceDetailsSchema = z
  .object({
    companyName: text(150),
    location: text(100),
    department: text(150),
    position: text(150),
    departmentManager: text(100),
    lines: z
      .partialRecord(z.enum(CLEARANCE_LINE_KEYS as [string, ...string[]]), clearanceLine)
      .default({}),
    signers: z
      .partialRecord(z.enum(CLEARANCE_SIGNER_KEYS as [string, ...string[]]), text(100))
      .default({}),
  })
  .strict();

export type ClearanceDetails = z.infer<typeof clearanceDetailsSchema>;

export const clearanceSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    formDate: requiredDate,
    endDate: optionalDate,
    details: clearanceDetailsSchema,
  })
  .strict();

export const updateClearanceSchema = clearanceSchema.extend({ id: z.string().min(1) });
export type ClearanceInput = z.infer<typeof clearanceSchema>;
