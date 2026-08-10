import { describe, expect, it } from "vitest";
import {
  isSensitive,
  PERMISSION_KEYS,
  PERMISSIONS,
  resolvePermissions,
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

describe("resolvePermissions", () => {
  const NOW = new Date("2026-08-10T12:00:00Z");
  const base = { rolePermissions: ["employees.view", "tasks.view"], isSuperAdmin: false, now: NOW };

  it("starts from the role's permissions", () => {
    const result = resolvePermissions({ ...base, overrides: [] });
    expect(result.has("employees.view")).toBe(true);
    expect(result.has("employees.delete")).toBe(false);
  });

  it("adds ALLOW overrides", () => {
    const result = resolvePermissions({
      ...base,
      overrides: [{ key: "employees.update", effect: "ALLOW", expiresAt: null }],
    });
    expect(result.has("employees.update")).toBe(true);
  });

  // DENY must beat the role grant, otherwise revoking access silently fails.
  it("lets DENY override a role grant", () => {
    const result = resolvePermissions({
      ...base,
      overrides: [{ key: "employees.view", effect: "DENY", expiresAt: null }],
    });
    expect(result.has("employees.view")).toBe(false);
  });

  it("lets DENY beat ALLOW regardless of ordering", () => {
    const allowFirst = resolvePermissions({
      ...base,
      overrides: [
        { key: "vault.reveal", effect: "ALLOW", expiresAt: null },
        { key: "vault.reveal", effect: "DENY", expiresAt: null },
      ],
    });
    const denyFirst = resolvePermissions({
      ...base,
      overrides: [
        { key: "vault.reveal", effect: "DENY", expiresAt: null },
        { key: "vault.reveal", effect: "ALLOW", expiresAt: null },
      ],
    });
    expect(allowFirst.has("vault.reveal")).toBe(false);
    expect(denyFirst.has("vault.reveal")).toBe(false);
  });

  it("ignores expired overrides", () => {
    const expired = new Date("2026-08-09T12:00:00Z");
    const allow = resolvePermissions({
      ...base,
      overrides: [{ key: "employees.delete", effect: "ALLOW", expiresAt: expired }],
    });
    expect(allow.has("employees.delete")).toBe(false);

    // An expired DENY must stop suppressing the role's grant.
    const deny = resolvePermissions({
      ...base,
      overrides: [{ key: "employees.view", effect: "DENY", expiresAt: expired }],
    });
    expect(deny.has("employees.view")).toBe(true);
  });

  it("honours overrides that have not yet expired", () => {
    const future = new Date("2026-08-11T12:00:00Z");
    const result = resolvePermissions({
      ...base,
      overrides: [{ key: "employees.delete", effect: "ALLOW", expiresAt: future }],
    });
    expect(result.has("employees.delete")).toBe(true);
  });

  it("gives SUPER_ADMIN every permission, including ones not in its role", () => {
    const result = resolvePermissions({
      rolePermissions: [],
      overrides: [],
      isSuperAdmin: true,
      now: NOW,
    });
    for (const key of PERMISSION_KEYS) {
      expect(result.has(key)).toBe(true);
    }
  });

  // Regression: the SUPER_ADMIN set must behave like a real Set. A previous
  // Proxy implementation threw on `.size` ("called on incompatible receiver"),
  // which surfaced as a 500 on the dashboard.
  it("returns a fully functional Set for SUPER_ADMIN", () => {
    const result = resolvePermissions({
      rolePermissions: [],
      overrides: [],
      isSuperAdmin: true,
      now: NOW,
    });
    expect(() => result.size).not.toThrow();
    expect(result.size).toBe(PERMISSION_KEYS.length);
    expect([...result]).toHaveLength(PERMISSION_KEYS.length);
  });

  it("does not let a DENY override strip SUPER_ADMIN", () => {
    const result = resolvePermissions({
      rolePermissions: [],
      overrides: [{ key: "vault.reveal", effect: "DENY", expiresAt: null }],
      isSuperAdmin: true,
      now: NOW,
    });
    expect(result.has("vault.reveal")).toBe(true);
  });
});
