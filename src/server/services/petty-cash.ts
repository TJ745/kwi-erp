import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import { calculateBalance, wouldOverdraw, type LedgerEntry } from "@/lib/petty-cash";
import type { AccountInput, TransactionInput } from "@/lib/schemas/petty-cash";

/**
 * Petty cash — brief §28.
 *
 * The balance is never stored. Every read recomputes it from the ledger via
 * `lib/petty-cash.ts`, so the figure on screen is always the figure the
 * transactions justify. See that module for why.
 */

export async function listAccounts(ctx: ActorContext) {
  const accounts = await prisma.pettyCashAccount.findMany({
    where: { ...companyScopeWhere(ctx) },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      openingBalance: true,
      currency: true,
      isActive: true,
      companyId: true,
      custodianId: true,
      company: { select: { code: true } },
      transactions: { select: { type: true, status: true, amount: true } },
    },
  });

  return accounts.map((account) => {
    const entries: LedgerEntry[] = account.transactions.map((t) => ({
      type: t.type,
      status: t.status,
      amount: t.amount.toString(),
    }));

    return {
      id: account.id,
      name: account.name,
      currency: account.currency,
      isActive: account.isActive,
      companyId: account.companyId,
      custodianId: account.custodianId,
      companyCode: account.company.code,
      openingBalance: account.openingBalance.toString(),
      transactionCount: account.transactions.length,
      balance: calculateBalance(account.openingBalance.toString(), entries),
    };
  });
}

export async function getAccount(ctx: ActorContext, id: string) {
  const account = await prisma.pettyCashAccount.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      openingBalance: true,
      currency: true,
      isActive: true,
      companyId: true,
      custodianId: true,
      company: { select: { code: true } },
      transactions: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 500,
        select: {
          id: true,
          date: true,
          type: true,
          description: true,
          amount: true,
          currency: true,
          paymentMethod: true,
          status: true,
          approvedAt: true,
          approvedById: true,
          createdById: true,
          notes: true,
          categoryId: true,
          requesterId: true,
          category: { select: { name: true, type: true } },
          requester: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!account) throw new NotFoundError("Account not found.");

  const entries: LedgerEntry[] = account.transactions.map((t) => ({
    type: t.type,
    status: t.status,
    amount: t.amount.toString(),
  }));

  return {
    ...account,
    openingBalanceText: account.openingBalance.toString(),
    balance: calculateBalance(account.openingBalance.toString(), entries),
  };
}

export async function cashCategories() {
  return prisma.pettyCashCategory.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });
}

// --- Accounts ----------------------------------------------------------------

export async function createAccount(ctx: ActorContext, input: AccountInput) {
  requireCompanyAccess(ctx, input.companyId);

  const clash = await prisma.pettyCashAccount.findFirst({
    where: { companyId: input.companyId, name: input.name },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`An account named "${input.name}" already exists.`);

  return prisma.pettyCashAccount.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      openingBalance: input.openingBalance,
      currency: input.currency,
      custodianId: input.custodianId ?? null,
      isActive: input.isActive,
    },
    select: { id: true, name: true, companyId: true, openingBalance: true },
  });
}

export async function updateAccount(
  ctx: ActorContext,
  input: AccountInput & { id: string },
) {
  const before = await prisma.pettyCashAccount.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      openingBalance: true,
      isActive: true,
      companyId: true,
    },
  });
  if (!before) throw new NotFoundError("Account not found.");
  requireCompanyAccess(ctx, input.companyId);

  const clash = await prisma.pettyCashAccount.findFirst({
    where: { companyId: input.companyId, name: input.name, id: { not: input.id } },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`An account named "${input.name}" already exists.`);

  const after = await prisma.pettyCashAccount.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      name: input.name,
      openingBalance: input.openingBalance,
      currency: input.currency,
      custodianId: input.custodianId ?? null,
      isActive: input.isActive,
    },
    select: {
      id: true,
      name: true,
      openingBalance: true,
      isActive: true,
      companyId: true,
    },
  });

  return {
    before: { ...before, openingBalance: before.openingBalance.toString() },
    after: { ...after, openingBalance: after.openingBalance.toString() },
  };
}

// --- Transactions ------------------------------------------------------------

/** Recomputes an account's balance from its ledger. */
async function balanceFor(accountId: string) {
  const account = await prisma.pettyCashAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: {
      openingBalance: true,
      currency: true,
      transactions: { select: { type: true, status: true, amount: true } },
    },
  });

  return calculateBalance(
    account.openingBalance.toString(),
    account.transactions.map((t) => ({
      type: t.type,
      status: t.status,
      amount: t.amount.toString(),
    })),
  );
}

export async function createTransaction(ctx: ActorContext, input: TransactionInput) {
  const account = await prisma.pettyCashAccount.findFirst({
    where: { id: input.accountId, ...companyScopeWhere(ctx) },
    select: { id: true, companyId: true, currency: true, isActive: true, name: true },
  });
  if (!account) throw new NotFoundError("Account not found.");
  if (!account.isActive) {
    throw new ConflictError("That account is closed and cannot take new transactions.");
  }

  const category = await prisma.pettyCashCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true, type: true },
  });
  if (!category) throw new NotFoundError("Category not found.");
  // A fuel expense filed as income would silently inflate the tin.
  if (category.type !== input.type) {
    throw new ConflictError(
      `"${category.name}" is a ${category.type.toLowerCase()} category.`,
    );
  }

  if (input.requesterId) {
    const requester = await prisma.employee.findFirst({
      where: { id: input.requesterId, companyId: account.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!requester) throw new NotFoundError("Requester not found in this company.");
  }

  const transaction = await prisma.pettyCashTransaction.create({
    data: {
      accountId: account.id,
      companyId: account.companyId,
      date: input.date,
      type: input.type,
      categoryId: input.categoryId,
      description: input.description,
      amount: input.amount,
      currency: account.currency,
      paymentMethod: input.paymentMethod,
      requesterId: input.requesterId ?? null,
      notes: input.notes ?? null,
      // Always PENDING on creation: creating and approving are separate
      // permissions, and letting a creator set APPROVED would collapse them.
      status: "PENDING",
      createdById: ctx.userId,
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      status: true,
      companyId: true,
    },
  });

  return { ...transaction, accountName: account.name, categoryName: category.name };
}

export async function updateTransaction(
  ctx: ActorContext,
  input: TransactionInput & { id: string },
) {
  const before = await prisma.pettyCashTransaction.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      status: true,
      date: true,
      companyId: true,
      accountId: true,
    },
  });
  if (!before) throw new NotFoundError("Transaction not found.");

  // An approved transaction is part of the reconciled ledger. Editing it would
  // silently change a balance somebody has already signed off.
  if (before.status !== "PENDING") {
    throw new ConflictError(
      `This transaction is ${before.status.toLowerCase()} and can no longer be edited.`,
    );
  }

  const category = await prisma.pettyCashCategory.findUnique({
    where: { id: input.categoryId },
    select: { name: true, type: true },
  });
  if (!category) throw new NotFoundError("Category not found.");
  if (category.type !== input.type) {
    throw new ConflictError(
      `"${category.name}" is a ${category.type.toLowerCase()} category.`,
    );
  }

  const after = await prisma.pettyCashTransaction.update({
    where: { id: input.id },
    data: {
      date: input.date,
      type: input.type,
      categoryId: input.categoryId,
      description: input.description,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      requesterId: input.requesterId ?? null,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      status: true,
      date: true,
      companyId: true,
      accountId: true,
    },
  });

  return {
    before: { ...before, amount: before.amount.toString() },
    after: { ...after, amount: after.amount.toString() },
  };
}

/**
 * Approves or rejects a pending transaction.
 *
 * Three controls, in order of how badly each is missed:
 *
 *   1. Separation of duties — nobody approves their own request. This is the
 *      whole reason `pettycash.approve` is a distinct permission.
 *   2. No overdraft — petty cash is physical money; you cannot pay out what is
 *      not in the tin. Checked at approval, not at request, because the
 *      balance moves between the two.
 *   3. Idempotence — a transaction already decided cannot be decided again.
 */
export async function decideTransaction(
  ctx: ActorContext,
  input: { id: string; decision: "APPROVED" | "REJECTED"; notes?: string | undefined },
) {
  const transaction = await prisma.pettyCashTransaction.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      description: true,
      amount: true,
      currency: true,
      type: true,
      status: true,
      companyId: true,
      accountId: true,
      createdById: true,
      account: { select: { name: true } },
    },
  });
  if (!transaction) throw new NotFoundError("Transaction not found.");

  if (transaction.status !== "PENDING") {
    throw new ConflictError(
      `That transaction is already ${transaction.status.toLowerCase()}.`,
    );
  }

  if (transaction.createdById === ctx.userId) {
    throw new ForbiddenError("You cannot approve a transaction you raised yourself.");
  }

  if (input.decision === "APPROVED" && transaction.type === "EXPENSE") {
    const balance = await balanceFor(transaction.accountId);
    if (wouldOverdraw(balance.current, transaction.amount.toString())) {
      throw new ConflictError(
        `Approving this would overdraw ${transaction.account.name}: balance is ${String(balance.current)} ${transaction.currency}, this expense is ${transaction.amount.toString()}.`,
      );
    }
  }

  await prisma.pettyCashTransaction.update({
    where: { id: input.id },
    data: {
      status: input.decision,
      approvedById: ctx.userId,
      approvedAt: new Date(),
      ...(input.notes ? { notes: input.notes } : {}),
    },
  });

  return {
    ...transaction,
    amountText: transaction.amount.toString(),
    before: transaction.status,
    after: input.decision,
  };
}

export async function cancelTransaction(ctx: ActorContext, id: string) {
  const transaction = await prisma.pettyCashTransaction.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      description: true,
      amount: true,
      status: true,
      companyId: true,
      createdById: true,
    },
  });
  if (!transaction) throw new NotFoundError("Transaction not found.");
  if (transaction.status !== "PENDING") {
    throw new ConflictError("Only a pending transaction can be cancelled.");
  }

  // Cancelled rather than deleted: the ledger keeps the attempt, and
  // calculateBalance treats it as history rather than a claim.
  await prisma.pettyCashTransaction.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return { ...transaction, amountText: transaction.amount.toString() };
}

/** Pending requests across every account the actor can see. */
export async function pendingApprovals(ctx: ActorContext) {
  return prisma.pettyCashTransaction.findMany({
    where: { status: "PENDING", ...companyScopeWhere(ctx) },
    orderBy: { date: "asc" },
    take: 100,
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      currency: true,
      type: true,
      createdById: true,
      account: { select: { id: true, name: true } },
      category: { select: { name: true } },
      requester: { select: { fullName: true } },
    },
  });
}

/** Employees who can be named as the requester on a transaction. */
export async function listEmployeesForCompany(ctx: ActorContext, companyId: string) {
  requireCompanyAccess(ctx, companyId);
  return prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, employeeNo: true },
  });
}
