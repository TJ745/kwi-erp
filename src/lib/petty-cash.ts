/**
 * Petty cash balance arithmetic — brief §28.
 *
 * Pure, and separate from the service, because getting this wrong is the kind
 * of bug that is only noticed when the tin does not reconcile at month end.
 *
 * Two rules carry the design:
 *
 *   1. The balance is DERIVED, never stored. A stored balance and a ledger
 *      disagree the first time anything is edited, and then nobody knows which
 *      one is right.
 *   2. Only APPROVED transactions move it. A pending request is a claim on the
 *      tin, not a withdrawal from it — but it is worth showing separately,
 *      because approving every pending request is what would actually overdraw.
 */

export type CashFlowType = "INCOME" | "EXPENSE";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LedgerEntry = {
  type: CashFlowType;
  status: ApprovalStatus;
  /** Decimal string, as it comes out of the database. */
  amount: string;
};

export type Balance = {
  /** What is actually in the tin: opening + approved income − approved expense. */
  current: number;
  /** Approved income only. */
  totalIn: number;
  /** Approved expense only. */
  totalOut: number;
  /** Expense that is requested but not yet approved. */
  pendingOut: number;
  /** What the balance would be if every pending expense were approved. */
  projected: number;
};

/**
 * Money is handled in integer minor units internally.
 *
 * Summing `Number("0.1") + Number("0.2")` gives 0.30000000000000004; do that a
 * few hundred times across a month's ledger and the balance is visibly wrong.
 */
function toMinorUnits(amount: string): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function fromMinorUnits(minor: number): number {
  return minor / 100;
}

export function calculateBalance(
  openingBalance: string,
  entries: readonly LedgerEntry[],
): Balance {
  let inMinor = 0;
  let outMinor = 0;
  let pendingOutMinor = 0;

  for (const entry of entries) {
    const minor = toMinorUnits(entry.amount);

    if (entry.status === "APPROVED") {
      if (entry.type === "INCOME") inMinor += minor;
      else outMinor += minor;
      continue;
    }

    // Rejected and cancelled requests are history, not claims.
    if (entry.status === "PENDING" && entry.type === "EXPENSE") {
      pendingOutMinor += minor;
    }
  }

  const openingMinor = toMinorUnits(openingBalance);
  const currentMinor = openingMinor + inMinor - outMinor;

  return {
    current: fromMinorUnits(currentMinor),
    totalIn: fromMinorUnits(inMinor),
    totalOut: fromMinorUnits(outMinor),
    pendingOut: fromMinorUnits(pendingOutMinor),
    projected: fromMinorUnits(currentMinor - pendingOutMinor),
  };
}

/**
 * Whether approving this expense would overdraw the account.
 *
 * Petty cash is physical money: you cannot pay out what is not in the tin. This
 * is checked at approval rather than at request, because the balance can change
 * between the two and the request is not what moves the money.
 */
export function wouldOverdraw(currentBalance: number, expenseAmount: string): boolean {
  const balanceMinor = Math.round(currentBalance * 100);
  return balanceMinor - toMinorUnits(expenseAmount) < 0;
}

/** Formats for display without pulling in a currency library. */
export function formatAmount(value: number, currency = "SAR"): string {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}
