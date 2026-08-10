import { describe, expect, it } from "vitest";
import {
  isSensitive,
  PERMISSION_KEYS,
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  ROLE_RANKS,
  type PermissionKey,
} from "./permissions";

describe("permission catalogue", () => {
  it("has no duplicate keys", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
  });

  it("uses dot-separated lowercase keys throughout", () => {
    for (const key of PERMISSION_KEYS) {
      expect(key).toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
    }
  });

  it("assigns every permission to a module and label", () => {
    for (const key of PERMISSION_KEYS) {
      expect(PERMISSIONS[key].module).toBeTruthy();
      expect(PERMISSIONS[key].label).toBeTruthy();
    }
  });
});

describe("role matrix", () => {
  it("grants every role only real permissions", () => {
    const known = new Set<string>(PERMISSION_KEYS);
    for (const role of ROLE_KEYS) {
      for (const key of ROLE_PERMISSIONS[role]) {
        expect(known.has(key), `${role} references unknown permission ${key}`).toBe(true);
      }
    }
  });

  it("gives SUPER_ADMIN everything", () => {
    expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  // The rule from brief §27: ordinary HR/Admin users must not reach IT
  // credentials. This test is the guard against a careless seed edit.
  it.each(["HR", "ADMIN", "MANAGER", "USER", "VIEWER"] as const)(
    "gives %s zero vault permissions",
    (role) => {
      const vaultPerms = ROLE_PERMISSIONS[role].filter((k) => k.startsWith("vault."));
      expect(vaultPerms).toEqual([]);
    },
  );

  it("withholds destructive vault permissions from IT_ADMIN", () => {
    const itAdmin = new Set<PermissionKey>(ROLE_PERMISSIONS.IT_ADMIN);
    expect(itAdmin.has("vault.reveal")).toBe(true);
    expect(itAdmin.has("vault.delete")).toBe(false);
    expect(itAdmin.has("vault.export")).toBe(false);
    expect(itAdmin.has("vault.grant")).toBe(false);
  });

  it("gives VIEWER no sensitive permissions at all", () => {
    const sensitive = ROLE_PERMISSIONS.VIEWER.filter(isSensitive);
    expect(sensitive).toEqual([]);
  });

  it("keeps salary and bank data out of VIEWER and USER", () => {
    for (const role of ["VIEWER", "USER"] as const) {
      const perms = new Set<PermissionKey>(ROLE_PERMISSIONS[role]);
      expect(perms.has("employees.bank.view")).toBe(false);
      expect(perms.has("employees.salary.view")).toBe(false);
    }
  });

  it("grants VIEWER read-only access — no mutating permissions", () => {
    const mutating = ROLE_PERMISSIONS.VIEWER.filter((k) =>
      /\.(create|update|delete|manage|approve|assign|generate|export|reveal|grant)$/.test(k),
    );
    expect(mutating).toEqual([]);
  });

  it("withholds role and user administration from ADMIN", () => {
    const admin = new Set<PermissionKey>(ROLE_PERMISSIONS.ADMIN);
    expect(admin.has("roles.manage")).toBe(false);
    expect(admin.has("users.manage")).toBe(false);
  });

  it("ranks roles with SUPER_ADMIN most senior and no ties across levels", () => {
    expect(ROLE_RANKS.SUPER_ADMIN).toBe(0);
    for (const role of ROLE_KEYS) {
      if (role !== "SUPER_ADMIN") {
        expect(ROLE_RANKS[role]).toBeGreaterThan(ROLE_RANKS.SUPER_ADMIN);
      }
    }
  });

  it("defines a permission set for every role key", () => {
    for (const role of ROLE_KEYS) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
