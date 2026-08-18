import { describe, expect, it } from "vitest";
import type { PermissionKey } from "./permissions";
import { decideBankRead, decideBankWrite, describeBankDenial } from "./bank-access";

const perms = (...keys: PermissionKey[]) => new Set<PermissionKey>(keys);

describe("decideBankRead", () => {
  it("allows an actor holding employees.bank.view", () => {
    expect(decideBankRead(perms("employees.bank.view"))).toEqual({
      allowed: true,
      blindWrite: false,
    });
  });

  it("refuses without it", () => {
    expect(decideBankRead(perms())).toEqual({ allowed: false, reason: "CANNOT_VIEW" });
  });

  it("is not satisfied by employees.view, however broad that is", () => {
    // The whole reason bank.view exists as a separate key.
    expect(decideBankRead(perms("employees.view", "employees.update"))).toEqual({
      allowed: false,
      reason: "CANNOT_VIEW",
    });
  });

  it("is not satisfied by the manage permission", () => {
    // Being allowed to change an IBAN does not mean being allowed to read one.
    expect(decideBankRead(perms("employees.bank.manage"))).toEqual({
      allowed: false,
      reason: "CANNOT_VIEW",
    });
  });
});

describe("decideBankWrite", () => {
  it("allows an actor holding employees.bank.manage", () => {
    expect(decideBankWrite(perms("employees.bank.manage", "employees.bank.view"))).toEqual({
      allowed: true,
      blindWrite: false,
    });
  });

  it("refuses without it", () => {
    expect(decideBankWrite(perms("employees.bank.view"))).toEqual({
      allowed: false,
      reason: "CANNOT_MANAGE",
    });
  });

  it("is not satisfied by employees.update", () => {
    expect(decideBankWrite(perms("employees.view", "employees.update"))).toEqual({
      allowed: false,
      reason: "CANNOT_MANAGE",
    });
  });

  it("reports a blind write when the actor can change but not read", () => {
    // The asymmetry stated in the module: allowed, but overwriting a value they
    // cannot see. It is reported so the audit trail can say so.
    expect(decideBankWrite(perms("employees.bank.manage"))).toEqual({
      allowed: true,
      blindWrite: true,
    });
  });

  it("does not report a blind write when the actor can also read", () => {
    expect(
      decideBankWrite(perms("employees.bank.manage", "employees.bank.view")).allowed &&
        decideBankWrite(perms("employees.bank.manage", "employees.bank.view")),
    ).toEqual({ allowed: true, blindWrite: false });
  });
});

describe("the two permissions are genuinely independent", () => {
  const cases: [string, PermissionKey[], boolean, boolean][] = [
    ["neither", [], false, false],
    ["view only", ["employees.bank.view"], true, false],
    ["manage only", ["employees.bank.manage"], false, true],
    ["both", ["employees.bank.view", "employees.bank.manage"], true, true],
  ];

  it.each(cases)("%s", (_name, keys, canRead, canWrite) => {
    expect(decideBankRead(perms(...keys)).allowed).toBe(canRead);
    expect(decideBankWrite(perms(...keys)).allowed).toBe(canWrite);
  });
});

describe("describeBankDenial", () => {
  it("says which of the two permissions is missing", () => {
    expect(describeBankDenial("CANNOT_VIEW")).toMatch(/view/i);
    expect(describeBankDenial("CANNOT_MANAGE")).toMatch(/edit|manage/i);
    // Not "forbidden" — the person needs to know which permission to ask for.
    expect(describeBankDenial("CANNOT_VIEW")).not.toMatch(/forbidden/i);
  });
});
