import { z } from "zod";
import { describeIbanProblem, validateIban } from "@/lib/bank";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "TERMINATED",
  "EXITED",
  "INACTIVE",
] as const;

/**
 * The employee's business identifier, typed by the person creating the record.
 *
 * The company numbered its people before it had this system, so the number is
 * theirs to supply — not generated, and not constrained to any one shape a
 * generator would have chosen. Letters, digits and the separators that appear
 * in real staff numbers; upper-cased so "kwi-014" and "KWI-014" cannot both
 * exist. Uniqueness is the database's job and is reported by the service.
 */
export const employeeNoSchema = z
  .string()
  .trim()
  .min(1, "Employee ID is required")
  .max(30, "At most 30 characters")
  .regex(/^[A-Za-z0-9][A-Za-z0-9/._-]*$/, "Letters, digits and - / . _ only")
  .transform((v) => v.toUpperCase());

const employeeSchemaObject = z
  .object({
    employeeNo: employeeNoSchema,
    companyId: z.string().min(1, "Company is required"),
    departmentId: z.string().optional().transform((v) => (v === "" || v === "none" ? undefined : v)),
    positionId: z.string().optional().transform((v) => (v === "" || v === "none" ? undefined : v)),
    managerId: z.string().optional().transform((v) => (v === "" || v === "none" ? undefined : v)),

    firstName: z.string().trim().min(1, "First name is required").max(80),
    // Optional: not every record has all four parts, but Saudi government
    // forms print each in its own box (see the clearance form template).
    middleName: optionalText(80),
    familyName: optionalText(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    fullNameAr: optionalText(200),

    gender: z.enum(["MALE", "FEMALE"]),
    dateOfBirth: optionalDate,
    nationality: z
      .string()
      .trim()
      .length(2, "Use a 2-letter country code")
      .transform((v) => v.toUpperCase()),
    maritalStatus: z
      .enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"])
      .optional()
      .or(z.literal("").transform(() => undefined)),

    status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
    employmentType: z
      .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERN"])
      .default("FULL_TIME"),
    joiningDate: requiredDate,
    lastWorkingDate: optionalDate,

    mobile: optionalText(30),
    workEmail: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    personalEmail: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    notes: optionalText(2000),
  })
  .strict();

/** Statuses that mean the person has left. */
export const LEAVING_STATUSES = ["RESIGNED", "TERMINATED", "EXITED"] as const;

/**
 * Cross-field rules, applied to create and update alike.
 *
 * Shared through a function rather than by intersecting schemas: an
 * intersection of a bare object with a strict one silently stops rejecting
 * unknown keys (verified — see storage of Phase 13 findings).
 */
function checkEmployeeDates(
  d: {
    joiningDate: Date;
    lastWorkingDate?: Date | undefined;
    status?: (typeof EMPLOYEE_STATUSES)[number] | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (d.lastWorkingDate && d.lastWorkingDate.getTime() < d.joiningDate.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "Last working date cannot precede the joining date",
      path: ["lastWorkingDate"],
    });
  }

  // `setEmployeeStatus` has always required this, but that service had no
  // caller — the edit form writes through `updateEmployee` instead, so someone
  // could be marked TERMINATED with no leaving date. Offboarding, final
  // settlement, and the leavers report all key off that date, so the rule
  // belongs on every path that can set the status, not just the one.
  if (
    d.status &&
    (LEAVING_STATUSES as readonly string[]).includes(d.status) &&
    !d.lastWorkingDate
  ) {
    ctx.addIssue({
      code: "custom",
      message: "A last working date is required when an employee leaves",
      path: ["lastWorkingDate"],
    });
  }
}

export const employeeSchema = employeeSchemaObject.superRefine(checkEmployeeDates);

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const updateEmployeeSchema = employeeSchemaObject.extend({ id: z.string().min(1) }).superRefine(checkEmployeeDates);

/** Status transitions are their own action: an employee is never deleted
 *  through the UI, only transitioned (brief §50). */
export const employeeStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(EMPLOYEE_STATUSES),
    lastWorkingDate: optionalDate,
    reason: optionalText(500),
  })
  .strict()
  .superRefine((d, ctx) => {
    // The service enforces this too, but it can fall back to a date already on
    // the record; here the form must show the error on the right field.
    if ((LEAVING_STATUSES as readonly string[]).includes(d.status) && !d.lastWorkingDate) {
      ctx.addIssue({
        code: "custom",
        message: "A last working date is required when an employee leaves",
        path: ["lastWorkingDate"],
      });
    }
  });

export const iqamaSchema = z
  .object({
    employeeId: z.string().min(1),
    iqamaNumber: z
      .string()
      .trim()
      .min(5, "Iqama number is required")
      .max(20)
      .regex(/^[0-9]+$/, "Digits only"),
    profession: z.string().trim().min(1, "Profession is required").max(150),
    professionAr: optionalText(150),
    issueDate: requiredDate,
    expiryDate: requiredDate,
    sponsorName: optionalText(150),
    notes: optionalText(1000),
  })
  .strict()
  .refine((d) => d.expiryDate.getTime() >= d.issueDate.getTime(), {
    message: "Expiry cannot precede the issue date",
    path: ["expiryDate"],
  });

export type IqamaInput = z.infer<typeof iqamaSchema>;

export const passportSchema = z
  .object({
    employeeId: z.string().min(1),
    passportNumber: z.string().trim().min(4, "Passport number is required").max(20),
    issueCountry: z
      .string()
      .trim()
      .length(2, "Use a 2-letter country code")
      .transform((v) => v.toUpperCase()),
    issuePlace: optionalText(100),
    issueDate: requiredDate,
    expiryDate: requiredDate,
    notes: optionalText(1000),
  })
  .strict()
  .refine((d) => d.expiryDate.getTime() >= d.issueDate.getTime(), {
    message: "Expiry cannot precede the issue date",
    path: ["expiryDate"],
  });

export type PassportInput = z.infer<typeof passportSchema>;

/** Opening a renewal takes only the employee: the date it replaces is read
 *  from the record, so history cannot record a date that was never true. */
export const startIqamaRenewalSchema = z
  .object({
    employeeId: z.string().min(1),
    notes: optionalText(1000),
  })
  .strict();

export const RENEWAL_STATUSES = [
  "IN_PROGRESS",
  "SUBMITTED",
  "COMPLETED",
  "REJECTED",
] as const;

export const updateIqamaRenewalSchema = z
  .object({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    status: z.enum(RENEWAL_STATUSES),
    submittedAt: optionalDate,
    newExpiry: optionalDate,
    notes: optionalText(1000),
  })
  .strict()
  .superRefine((d, ctx) => {
    // The service refuses this too; here it lands on the field that is wrong.
    if (d.status === "COMPLETED" && !d.newExpiry) {
      ctx.addIssue({
        code: "custom",
        message: "A new expiry date is required to complete a renewal",
        path: ["newExpiry"],
      });
    }
  });

export const emergencyContactSchema = z
  .object({
    employeeId: z.string().min(1),
    name: z.string().trim().min(2, "Name is required").max(150),
    relation: z.string().trim().min(2, "Relationship is required").max(60),
    phone: z.string().trim().min(5, "Phone is required").max(30),
    altPhone: optionalText(30),
    address: optionalText(300),
  })
  .strict();

export const updateEmergencyContactSchema = emergencyContactSchema
  .extend({ id: z.string().min(1) })
  .strict();

export const emergencyContactIdSchema = z
  .object({ id: z.string().min(1), employeeId: z.string().min(1) })
  .strict();

/**
 * Bank details.
 *
 * The IBAN is checksum-validated here rather than only in the service, so the
 * form can point at the field and say what is wrong with it.
 */
export const bankDetailSchema = z
  .object({
    employeeId: z.string().min(1),
    bankName: z.string().trim().min(2, "Bank name is required").max(150),
    iban: z.string().trim().min(1, "An IBAN is required").max(40),
    accountNo: optionalText(50),
    swift: optionalText(20),
    verifiedAt: optionalDate,
  })
  .strict()
  .superRefine((d, ctx) => {
    const result = validateIban(d.iban);
    if (!result.ok) {
      ctx.addIssue({
        code: "custom",
        message: describeIbanProblem(result.problem),
        path: ["iban"],
      });
    }
  });

export type BankDetailInput = z.infer<typeof bankDetailSchema>;

export const bankDetailIdSchema = z.object({ employeeId: z.string().min(1) }).strict();
