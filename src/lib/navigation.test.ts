import { describe, expect, it } from "vitest";
import { findNavItem, NAVIGATION, visibleNavigation } from "./navigation";
import { PERMISSION_KEYS, ROLE_PERMISSIONS, type PermissionKey } from "./permissions";

const asSet = (keys: readonly PermissionKey[]) => new Set<PermissionKey>(keys);

describe("navigation catalogue", () => {
  it("references only real permissions", () => {
    const known = new Set<string>(PERMISSION_KEYS);
    for (const section of NAVIGATION) {
      for (const item of section.items) {
        for (const key of item.permissions) {
          expect(known.has(key), `${item.href} references unknown permission ${key}`).toBe(true);
        }
      }
    }
  });

  it("has a unique href per item", () => {
    const hrefs = NAVIGATION.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every item at least one permission", () => {
    for (const section of NAVIGATION) {
      for (const item of section.items) {
        expect(item.permissions.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("visibleNavigation", () => {
  it("drops sections whose items are all hidden", () => {
    const sections = visibleNavigation(asSet(["dashboard.view"]));
    expect(sections).toHaveLength(1);
    expect(sections[0]?.label).toBe("Overview");
  });

  it("returns nothing for an actor with no permissions", () => {
    expect(visibleNavigation(asSet([]))).toEqual([]);
  });

  // The vault must never appear for a role without vault.view — this is the
  // navigation-level half of the rule in brief §27.
  it.each(["HR", "ADMIN", "MANAGER", "USER", "VIEWER"] as const)(
    "hides the Password Vault from %s",
    (role) => {
      const sections = visibleNavigation(asSet(ROLE_PERMISSIONS[role]));
      const labels = sections.flatMap((s) => s.items.map((i) => i.label));
      expect(labels).not.toContain("Password Vault");
    },
  );

  it("shows the Password Vault to IT_ADMIN", () => {
    const sections = visibleNavigation(asSet(ROLE_PERMISSIONS.IT_ADMIN));
    const labels = sections.flatMap((s) => s.items.map((i) => i.label));
    expect(labels).toContain("Password Vault");
  });

  // ADMIN holds users.view but NOT users.manage, so it gets a read-only user
  // list; the row actions are gated separately in the page. Role editing needs
  // roles.manage, which ADMIN does not hold at all.
  it("gives ADMIN read-only users but no role editing", () => {
    const perms = asSet(ROLE_PERMISSIONS.ADMIN);
    const labels = visibleNavigation(perms).flatMap((s) => s.items.map((i) => i.label));

    expect(labels).toContain("Users");
    expect(perms.has("users.manage")).toBe(false);

    expect(labels).not.toContain("Roles & Permissions");
    expect(perms.has("roles.manage")).toBe(false);
  });

  it("hides user administration from VIEWER entirely", () => {
    const labels = visibleNavigation(asSet(ROLE_PERMISSIONS.VIEWER)).flatMap((s) =>
      s.items.map((i) => i.label),
    );
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Roles & Permissions");
  });

  it("shows everything to SUPER_ADMIN", () => {
    const sections = visibleNavigation(asSet(ROLE_PERMISSIONS.SUPER_ADMIN));
    const total = NAVIGATION.reduce((n, s) => n + s.items.length, 0);
    const shown = sections.reduce((n, s) => n + s.items.length, 0);
    expect(shown).toBe(total);
  });
});

describe("findNavItem", () => {
  it("matches an exact route", () => {
    expect(findNavItem("/settings/users")?.item.label).toBe("Users");
  });

  it("matches a nested route to its parent item", () => {
    expect(findNavItem("/settings/roles/abc123")?.item.label).toBe("Roles & Permissions");
  });

  it("prefers the longest matching prefix", () => {
    // /vehicles and /vehicles/maintenance both prefix-match; the longer wins.
    expect(findNavItem("/vehicles/maintenance")?.item.label).toBe("Maintenance");
  });

  it("returns null for an unknown route", () => {
    expect(findNavItem("/nothing/here")).toBeNull();
  });
});
