/**
 * Who may sign off a clearance step.
 *
 * Offboarding steps carry a responsible department — IT confirms the laptop is
 * back, Finance confirms the advance is settled. Until now anyone who could
 * open the checklist could tick any of them, which makes departmental sign-off
 * a label rather than a control.
 *
 * Pure, so the combinations can be tested directly instead of by arranging a
 * checklist, a template, an employee and a department and reading rows back.
 */

export type ClearanceActor = {
  /** Effective permissions, already resolved. */
  canConfirm: boolean;
  /** True for ADMIN/SUPER_ADMIN — the deadlock escape, recorded when used. */
  canOverride: boolean;
  /** The actor's own employee record, if they have one. */
  employee: { departmentId: string | null; headsDepartmentIds: readonly string[] } | null;
  roleId: string;
};

export type ClearanceItem = {
  responsibleDepartmentId: string | null;
  responsibleRoleId: string | null;
};

export type ClearanceDecision =
  | { allowed: true; viaOverride: boolean }
  | { allowed: false; reason: ClearanceDenial };

export type ClearanceDenial =
  | "NEEDS_CONFIRM_PERMISSION"
  | "WRONG_DEPARTMENT"
  | "WRONG_ROLE"
  | "NO_EMPLOYEE_RECORD";

/**
 * An item with no responsible department or role is unowned, and anyone who can
 * manage the checklist may complete it — that is the existing behaviour and
 * most items are like this. The rules below apply only to owned steps.
 */
export function decideClearance(
  item: ClearanceItem,
  actor: ClearanceActor,
): ClearanceDecision {
  const isOwned = item.responsibleDepartmentId !== null || item.responsibleRoleId !== null;
  if (!isOwned) return { allowed: true, viaOverride: false };

  if (!actor.canConfirm) return { allowed: false, reason: "NEEDS_CONFIRM_PERMISSION" };

  if (item.responsibleRoleId !== null) {
    if (actor.roleId === item.responsibleRoleId) return { allowed: true, viaOverride: false };
    // An override still applies to a role-owned step; it is the same escape.
    if (actor.canOverride) return { allowed: true, viaOverride: true };
    return { allowed: false, reason: "WRONG_ROLE" };
  }

  // Department-owned from here.
  if (!actor.employee) {
    // Someone with no employee record cannot belong to a department. The
    // override is the only way through, and it is recorded.
    if (actor.canOverride) return { allowed: true, viaOverride: true };
    return { allowed: false, reason: "NO_EMPLOYEE_RECORD" };
  }

  const belongs =
    actor.employee.departmentId === item.responsibleDepartmentId ||
    actor.employee.headsDepartmentIds.includes(item.responsibleDepartmentId ?? "");

  if (belongs) return { allowed: true, viaOverride: false };
  if (actor.canOverride) return { allowed: true, viaOverride: true };
  return { allowed: false, reason: "WRONG_DEPARTMENT" };
}

export function describeClearanceDenial(reason: ClearanceDenial): string {
  switch (reason) {
    case "NEEDS_CONFIRM_PERMISSION":
      return "This step is signed off by the responsible department, which needs the clearance permission.";
    case "WRONG_DEPARTMENT":
      return "This step belongs to another department, and only that department can confirm it.";
    case "WRONG_ROLE":
      return "This step belongs to another role, and only that role can confirm it.";
    case "NO_EMPLOYEE_RECORD":
      return "This step is confirmed by a department, and your account is not linked to an employee record.";
  }
}
