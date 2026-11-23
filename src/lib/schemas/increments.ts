import { z } from "zod";
import { parseAmount } from "@/lib/increments";

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

/** A typed amount; blank means 0. Stored as a 2-decimal string. */
const amount = z
  .string()
  .max(20)
  .refine((v) => parseAmount(v) !== null, "Enter an amount, e.g. 4200 or 4200.50")
  .transform((v) => ((parseAmount(v) ?? 0) / 100).toFixed(2));

/** Blank means "not recorded" (null) — distinct from a recorded 0. */
const optionalAmount = z
  .string()
  .max(20)
  .refine((v) => parseAmount(v) !== null, "Enter an amount, e.g. 4200 or 4200.50")
  .transform((v) => (v.trim() === "" ? null : ((parseAmount(v) ?? 0) / 100).toFixed(2)));

const breakdown = z
  .object({ basic: amount, transport: amount, housing: amount, other: amount })
  .strict();

// --- Increment lists ----------------------------------------------------------

export const incrementListSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(200),
    listDate: requiredDate,
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .strict();

export const updateIncrementListSchema = incrementListSchema.extend({ id: z.string().min(1) });
export type IncrementListInput = z.infer<typeof incrementListSchema>;

export const MAX_LIST_EMPLOYEES = 500;

export const addListEmployeesSchema = z
  .object({
    listId: z.string().min(1),
    employeeIds: z
      .array(z.string().min(1))
      .min(1, "Pick at least one employee")
      .max(MAX_LIST_EMPLOYEES),
  })
  .strict();

export const saveListLinesSchema = z
  .object({
    listId: z.string().min(1),
    lines: z
      .array(z.object({ id: z.string().min(1), demanded: breakdown, proposed: breakdown }).strict())
      .max(MAX_LIST_EMPLOYEES),
  })
  .strict();
export type SaveListLinesInput = z.infer<typeof saveListLinesSchema>;

export const incrementIdSchema = z.object({ id: z.string().min(1) }).strict();

// --- Employee salary ------------------------------------------------------------

export const employeeSalarySchema = z
  .object({
    employeeId: z.string().min(1),
    basic: optionalAmount,
    transport: optionalAmount,
    housing: optionalAmount,
    other: optionalAmount,
  })
  .strict();
export type EmployeeSalaryInput = z.infer<typeof employeeSalarySchema>;
