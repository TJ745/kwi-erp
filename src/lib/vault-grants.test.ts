import { describe, expect, it } from "vitest";
import {
  applicableGrants,
  manageHolders,
  wouldStrandCredential,
  type CandidateUser,
  type GrantLike,
} from "./vault-grants";

/**
 * This predicate is the only thing standing between an administrator and
 * permanently locking the organisation out of a credential. There is no
 * administrator exemption in the resolver, so a wrong answer here is
 * recoverable only from the database.
 */

const NOW = new Date("2026-08-18T12:00:00.000Z");
const CRED = { id: "cred1", categoryId: "cat1" };

const grant = (over: Partial<GrantLike> = {}): GrantLike => ({
  credentialId: CRED.id,
  categoryId: null,
  userId: null,
  roleId: null,
  level: "MANAGE",
  expiresAt: null,
  ...over,
});

const user = (over: Partial<CandidateUser> = {}): CandidateUser => ({
  id: "u1",
  roleId: "r1",
  holdsVaultUpdate: true,
  ...over,
});

describe("wouldStrandCredential", () => {
  it("does not strand a credential that has no grants at all", () => {
    // Zero grants means open to everyone with the vault permission — safe, and
    // the asymmetry that makes this whole check subtle.
    expect(wouldStrandCredential([], CRED, [user()], NOW)).toBe(false);
  });

  it("strands when the only grant names somebody who cannot use the vault", () => {
    // The case that makes the naive version wrong: nominal access is not access.
    const grants = [grant({ userId: "u2" })];
    const users = [user({ id: "u2", holdsVaultUpdate: false })];
    expect(wouldStrandCredential(grants, CRED, users, NOW)).toBe(true);
  });

  it("does not strand when that person does hold the permission", () => {
    const grants = [grant({ userId: "u2" })];
    const users = [user({ id: "u2", holdsVaultUpdate: true })];
    expect(wouldStrandCredential(grants, CRED, users, NOW)).toBe(false);
  });

  it("strands when every grant is below MANAGE", () => {
    const grants = [grant({ userId: "u1", level: "READ" }), grant({ userId: "u2", level: "REVEAL" })];
    const users = [user({ id: "u1" }), user({ id: "u2" })];
    expect(wouldStrandCredential(grants, CRED, users, NOW)).toBe(true);
  });

  it("strands when the only MANAGE grant has expired", () => {
    const grants = [grant({ userId: "u1", expiresAt: new Date("2026-08-17T00:00:00.000Z") })];
    expect(wouldStrandCredential(grants, CRED, [user()], NOW)).toBe(true);
  });

  it("does not strand when the MANAGE grant expires in the future", () => {
    const grants = [grant({ userId: "u1", expiresAt: new Date("2026-12-31T00:00:00.000Z") })];
    expect(wouldStrandCredential(grants, CRED, [user()], NOW)).toBe(false);
  });

  it("accepts a grant held through a role", () => {
    const grants = [grant({ roleId: "r9", userId: null })];
    const users = [user({ id: "u5", roleId: "r9" })];
    expect(wouldStrandCredential(grants, CRED, users, NOW)).toBe(false);
  });

  it("does not match a role grant against the wrong role", () => {
    const grants = [grant({ roleId: "r9", userId: null })];
    const users = [user({ id: "u5", roleId: "r1" })];
    expect(wouldStrandCredential(grants, CRED, users, NOW)).toBe(true);
  });

  it("never matches a null roleId against a user, however the data looks", () => {
    // A grant with neither subject is meaningless; it must not silently match.
    const grants = [grant({ userId: null, roleId: null })];
    expect(wouldStrandCredential(grants, CRED, [user()], NOW)).toBe(true);
  });

  it("accepts a MANAGE grant inherited from the category", () => {
    const grants = [grant({ credentialId: null, categoryId: "cat1", userId: "u1" })];
    expect(wouldStrandCredential(grants, CRED, [user()], NOW)).toBe(false);
  });

  it("ignores a grant on a different credential or category", () => {
    const grants = [
      grant({ credentialId: "other", userId: "u1" }),
      grant({ credentialId: null, categoryId: "othercat", userId: "u1" }),
    ];
    // Those grants exist, so the credential IS restricted, but nobody named on
    // it can manage it.
    expect(wouldStrandCredential(grants, CRED, [user()], NOW)).toBe(true);
  });

  it("survives with one valid manager among several useless grants", () => {
    const grants = [
      grant({ userId: "u1", level: "READ" }),
      grant({ userId: "u2", expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
      grant({ userId: "u3" }),
    ];
    const users = [user({ id: "u1" }), user({ id: "u2" }), user({ id: "u3" })];
    expect(wouldStrandCredential(grants, CRED, users, NOW)).toBe(false);
  });

  it("strands when there are no candidate users at all", () => {
    expect(wouldStrandCredential([grant({ userId: "u1" })], CRED, [], NOW)).toBe(true);
  });
});

describe("manageHolders", () => {
  it("returns everyone who qualifies, not just the first", () => {
    const grants = [grant({ userId: "u1" }), grant({ roleId: "r2", userId: null })];
    const users = [user({ id: "u1" }), user({ id: "u2", roleId: "r2" }), user({ id: "u3" })];
    expect(manageHolders(grants, CRED, users, NOW).sort()).toEqual(["u1", "u2"]);
  });

  it("returns nobody when no grant reaches MANAGE", () => {
    const grants = [grant({ userId: "u1", level: "REVEAL" })];
    expect(manageHolders(grants, CRED, [user()], NOW)).toEqual([]);
  });
});

describe("applicableGrants", () => {
  it("filters by level threshold", () => {
    const grants = [
      grant({ userId: "a", level: "READ" }),
      grant({ userId: "b", level: "REVEAL" }),
      grant({ userId: "c", level: "MANAGE" }),
    ];
    expect(applicableGrants(grants, CRED, "READ", NOW)).toHaveLength(3);
    expect(applicableGrants(grants, CRED, "REVEAL", NOW)).toHaveLength(2);
    expect(applicableGrants(grants, CRED, "MANAGE", NOW)).toHaveLength(1);
  });

  it("treats an expiry exactly at now as expired", () => {
    const grants = [grant({ userId: "a", expiresAt: NOW })];
    expect(applicableGrants(grants, CRED, "MANAGE", NOW)).toHaveLength(0);
  });
});
