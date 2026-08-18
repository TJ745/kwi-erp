import { describe, expect, it } from "vitest";
import {
  decideClearance,
  describeClearanceDenial,
  type ClearanceActor,
  type ClearanceItem,
} from "./clearance";

const IT_DEPT = "dept-it";
const HR_DEPT = "dept-hr";

const item = (over: Partial<ClearanceItem> = {}): ClearanceItem => ({
  responsibleDepartmentId: null,
  responsibleRoleId: null,
  ...over,
});

const actor = (over: Partial<ClearanceActor> = {}): ClearanceActor => ({
  canConfirm: true,
  canOverride: false,
  employee: { departmentId: IT_DEPT, headsDepartmentIds: [] },
  roleId: "role-it",
  ...over,
});

describe("unowned steps keep the existing behaviour", () => {
  it("anyone managing the checklist may complete a step with no owner", () => {
    // Most items are like this; the rule must not make ordinary onboarding
    // require a clearance permission nobody has.
    expect(decideClearance(item(), actor({ canConfirm: false, employee: null }))).toEqual({
      allowed: true,
      viaOverride: false,
    });
  });
});

describe("department-owned steps", () => {
  it("allows a member of the responsible department", () => {
    expect(
      decideClearance(item({ responsibleDepartmentId: IT_DEPT }), actor()),
    ).toEqual({ allowed: true, viaOverride: false });
  });

  it("allows the head of the responsible department even if posted elsewhere", () => {
    const head = actor({
      employee: { departmentId: HR_DEPT, headsDepartmentIds: [IT_DEPT] },
    });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), head)).toEqual({
      allowed: true,
      viaOverride: false,
    });
  });

  it("refuses another department — the point of the whole feature", () => {
    const outsider = actor({ employee: { departmentId: HR_DEPT, headsDepartmentIds: [] } });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), outsider)).toEqual({
      allowed: false,
      reason: "WRONG_DEPARTMENT",
    });
  });

  it("refuses without the clearance permission, whoever they are", () => {
    const member = actor({ canConfirm: false });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), member)).toEqual({
      allowed: false,
      reason: "NEEDS_CONFIRM_PERMISSION",
    });
  });

  it("checks the permission before the department, so the reason is the useful one", () => {
    const outsider = actor({
      canConfirm: false,
      employee: { departmentId: HR_DEPT, headsDepartmentIds: [] },
    });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), outsider).allowed).toBe(
      false,
    );
    expect(
      decideClearance(item({ responsibleDepartmentId: IT_DEPT }), outsider),
    ).toHaveProperty("reason", "NEEDS_CONFIRM_PERMISSION");
  });

  it("refuses an account with no employee record", () => {
    expect(
      decideClearance(item({ responsibleDepartmentId: IT_DEPT }), actor({ employee: null })),
    ).toEqual({ allowed: false, reason: "NO_EMPLOYEE_RECORD" });
  });

  it("refuses an employee in no department at all", () => {
    const floating = actor({ employee: { departmentId: null, headsDepartmentIds: [] } });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), floating)).toEqual({
      allowed: false,
      reason: "WRONG_DEPARTMENT",
    });
  });
});

describe("the administrative override", () => {
  it("lets an administrator through, and says it was an override", () => {
    // Recorded rather than silent: the audit entry has to show that a step was
    // signed off from outside the department that owns it.
    const admin = actor({
      canOverride: true,
      employee: { departmentId: HR_DEPT, headsDepartmentIds: [] },
    });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), admin)).toEqual({
      allowed: true,
      viaOverride: true,
    });
  });

  it("does not report an override when the actor genuinely belonged", () => {
    const adminInDept = actor({ canOverride: true });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), adminInDept)).toEqual({
      allowed: true,
      viaOverride: false,
    });
  });

  it("does not rescue an administrator who lacks the clearance permission", () => {
    // The override widens WHERE they can sign off, not WHETHER they may.
    const admin = actor({ canOverride: true, canConfirm: false });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), admin)).toEqual({
      allowed: false,
      reason: "NEEDS_CONFIRM_PERMISSION",
    });
  });

  it("rescues an administrator with no employee record", () => {
    // Otherwise a system with no admin linked to an employee could never
    // complete a departmental step at all.
    const admin = actor({ canOverride: true, employee: null });
    expect(decideClearance(item({ responsibleDepartmentId: IT_DEPT }), admin)).toEqual({
      allowed: true,
      viaOverride: true,
    });
  });
});

describe("role-owned steps", () => {
  it("allows the responsible role", () => {
    expect(
      decideClearance(item({ responsibleRoleId: "role-it" }), actor()),
    ).toEqual({ allowed: true, viaOverride: false });
  });

  it("refuses another role", () => {
    expect(
      decideClearance(item({ responsibleRoleId: "role-hr" }), actor()),
    ).toEqual({ allowed: false, reason: "WRONG_ROLE" });
  });

  it("takes the role over the department when both are set", () => {
    const decision = decideClearance(
      item({ responsibleRoleId: "role-hr", responsibleDepartmentId: IT_DEPT }),
      actor(),
    );
    expect(decision).toEqual({ allowed: false, reason: "WRONG_ROLE" });
  });
});

describe("describeClearanceDenial", () => {
  it("explains every reason in terms the person can act on", () => {
    for (const reason of [
      "NEEDS_CONFIRM_PERMISSION",
      "WRONG_DEPARTMENT",
      "WRONG_ROLE",
      "NO_EMPLOYEE_RECORD",
    ] as const) {
      const message = describeClearanceDenial(reason);
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toMatch(/forbidden|denied|error/i);
    }
  });
});
