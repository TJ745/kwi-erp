"use server";

import {
  accountSchema,
  decideTransactionSchema,
  pettyCashIdSchema,
  transactionSchema,
  updateAccountSchema,
  updateTransactionSchema,
} from "@/lib/schemas/petty-cash";
import { defineAction } from "./define-action";
import {
  cancelTransaction,
  createAccount,
  createTransaction,
  decideTransaction,
  updateAccount,
  updateTransaction,
} from "@/server/services/petty-cash";

const PATHS = ["/admin/petty-cash"];

export const createAccountAction = defineAction({
  permission: "pettycash.view",
  schema: accountSchema,
  audit: { action: "CREATE", entity: "PETTY_CASH_TRANSACTION" },
  handler: async ({ input, ctx, audit }) => {
    const account = await createAccount(ctx, input);
    audit.record({
      entityId: account.id,
      companyId: account.companyId,
      summary: `Opened petty cash account "${account.name}" with ${account.openingBalance.toString()} opening balance`,
      after: { name: account.name, openingBalance: account.openingBalance.toString() },
    });
    return { id: account.id };
  },
  revalidate: () => PATHS,
});

export const updateAccountAction = defineAction({
  permission: "pettycash.view",
  schema: updateAccountSchema,
  audit: { action: "UPDATE", entity: "PETTY_CASH_TRANSACTION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateAccount(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      // The opening balance shifts every historical balance, so a change to it
      // is the one edit here that must be obvious in the trail.
      summary: `Updated petty cash account "${after.name}"`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => PATHS,
});

export const createTransactionAction = defineAction({
  permission: "pettycash.create",
  schema: transactionSchema,
  audit: { action: "CREATE", entity: "PETTY_CASH_TRANSACTION" },
  handler: async ({ input, ctx, audit }) => {
    const transaction = await createTransaction(ctx, input);
    audit.record({
      entityId: transaction.id,
      companyId: transaction.companyId,
      summary: `Raised ${transaction.type.toLowerCase()} of ${transaction.amount.toString()} on ${transaction.accountName} — ${transaction.description}`,
      after: {
        amount: transaction.amount.toString(),
        type: transaction.type,
        category: transaction.categoryName,
        status: transaction.status,
      },
    });
    return { id: transaction.id };
  },
  revalidate: () => PATHS,
});

export const updateTransactionAction = defineAction({
  permission: "pettycash.create",
  schema: updateTransactionSchema,
  audit: { action: "UPDATE", entity: "PETTY_CASH_TRANSACTION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateTransaction(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Edited pending transaction — ${after.description}`,
      before: { amount: before.amount, type: before.type, date: before.date },
      after: { amount: after.amount, type: after.type, date: after.date },
    });
    return { id: after.id };
  },
  revalidate: () => PATHS,
});

/**
 * Approval is its own permission AND its own action. The service refuses
 * self-approval and refuses to overdraw the account.
 */
export const decideTransactionAction = defineAction({
  permission: "pettycash.approve",
  schema: decideTransactionSchema,
  audit: { action: "APPROVE", entity: "PETTY_CASH_TRANSACTION" },
  handler: async ({ input, ctx, audit }) => {
    const result = await decideTransaction(ctx, input);
    audit.record({
      entityId: result.id,
      companyId: result.companyId,
      summary: `${input.decision === "APPROVED" ? "Approved" : "Rejected"} ${result.amountText} ${result.currency} on ${result.account.name} — ${result.description}`,
      before: { status: result.before },
      after: { status: result.after },
    });
    return { id: result.id };
  },
  revalidate: () => PATHS,
});

export const cancelTransactionAction = defineAction({
  permission: "pettycash.create",
  schema: pettyCashIdSchema,
  audit: { action: "UPDATE", entity: "PETTY_CASH_TRANSACTION" },
  handler: async ({ input, ctx, audit }) => {
    const transaction = await cancelTransaction(ctx, input.id);
    audit.record({
      entityId: transaction.id,
      companyId: transaction.companyId,
      summary: `Cancelled request for ${transaction.amountText} — ${transaction.description}`,
      before: { status: transaction.status },
      after: { status: "CANCELLED" },
    });
    return { id: transaction.id };
  },
  revalidate: () => PATHS,
});
