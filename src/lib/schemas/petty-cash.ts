import { z } from "zod";

/** Petty cash — brief §28. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === "none" || v === undefined ? undefined : v));

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

/** Positive only: direction is carried by `type`, not by the sign. */
const positiveMoney = z
  .string()
  .min(1, "Amount is required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

export const CASH_FLOW_TYPES = ["INCOME", "EXPENSE"] as const;
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "CARD"] as const;
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export const accountSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    name: z.string().trim().min(2, "Account name is required").max(120),
    openingBalance: z
      .string()
      .default("0")
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount"),
    currency: z.string().trim().length(3).default("SAR"),
    custodianId: optionalId,
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateAccountSchema = accountSchema.extend({ id: z.string().min(1) });

export type AccountInput = z.infer<typeof accountSchema>;

const transactionObject = z
  .object({
    accountId: z.string().min(1, "Account is required"),
    date: requiredDate,
    type: z.enum(CASH_FLOW_TYPES),
    categoryId: z.string().min(1, "Category is required"),
    description: z.string().trim().min(2, "Description is required").max(300),
    amount: positiveMoney,
    paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
    requesterId: optionalId,
    notes: optionalText(1000),
  })
  .strict();

export const transactionSchema = transactionObject;
export const updateTransactionSchema = transactionObject.extend({
  id: z.string().min(1),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export const pettyCashIdSchema = z.object({ id: z.string().min(1) }).strict();

export const decideTransactionSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    notes: optionalText(500),
  })
  .strict();
