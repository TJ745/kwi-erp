/**
 * Who may see and who may change payroll bank details.
 *
 * Split out as a pure function because this is the field that decides where
 * somebody's salary lands, and because the rules have an asymmetry that is easy
 * to get wrong by accident — see `WRITE_DOES_NOT_REQUIRE_READ` below.
 *
 * The checks stay in the service too. This is the decision; the service applies
 * it after establishing that the employee is in scope at all, because "no such
 * employee" and "not allowed to see their bank details" are different answers
 * and must not be reordered.
 */

import type { PermissionKey } from "./permissions";

export type BankAccessDecision =
  | { allowed: true; blindWrite: boolean }
  | { allowed: false; reason: BankDenial };

export type BankDenial = "CANNOT_VIEW" | "CANNOT_MANAGE";

/**
 * `employees.bank.manage` does NOT require `employees.bank.view`.
 *
 * Deliberate, and worth stating: someone can be allowed to enter or correct an
 * IBAN without being allowed to read the one already stored. That is a real
 * arrangement — a clerk keying in a bank letter does not need to see the
 * existing account — and it is also how a DENY override on `bank.view` behaves
 * for a role that holds `bank.manage`.
 *
 * The consequence is a blind write: the actor overwrites a value they cannot
 * see. `decideBankWrite` reports it so the caller can record that in the audit
 * trail rather than leaving it invisible.
 */
export const WRITE_DOES_NOT_REQUIRE_READ = true;

export function decideBankRead(
  permissions: ReadonlySet<PermissionKey>,
): BankAccessDecision {
  if (!permissions.has("employees.bank.view")) {
    return { allowed: false, reason: "CANNOT_VIEW" };
  }
  return { allowed: true, blindWrite: false };
}

export function decideBankWrite(
  permissions: ReadonlySet<PermissionKey>,
): BankAccessDecision {
  if (!permissions.has("employees.bank.manage")) {
    return { allowed: false, reason: "CANNOT_MANAGE" };
  }

  return { allowed: true, blindWrite: !permissions.has("employees.bank.view") };
}

export function describeBankDenial(reason: BankDenial): string {
  switch (reason) {
    case "CANNOT_VIEW":
      return "You do not have permission to view bank details.";
    case "CANNOT_MANAGE":
      return "You do not have permission to edit bank details.";
  }
}
