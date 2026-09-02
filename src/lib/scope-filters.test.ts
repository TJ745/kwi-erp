import { describe, expect, it } from "vitest";
import { allOf, pooledOrScoped } from "./scope-filters";

describe("pooledOrScoped", () => {
  it("wraps the relation in `is`, even when the scope is empty", () => {
    // The regression this exists for. `{ employee: {} }` is dropped by Prisma
    // inside an OR, which hides every assigned row from an ALL-scope viewer.
    const [pooled, assigned] = pooledOrScoped("employeeId", "employee", {});
    expect(pooled).toEqual({ employeeId: null });
    expect(assigned).toEqual({ employee: { is: {} } });
  });

  it("never emits a bare empty relation object", () => {
    for (const scope of [{}, { companyId: { in: ["a"] } }]) {
      const [, assigned] = pooledOrScoped("employeeId", "employee", scope);
      const relation = (assigned as { employee: unknown }).employee;
      expect(relation).not.toEqual({});
      expect(relation).toHaveProperty("is");
    }
  });

  it("carries a real scope through unchanged", () => {
    const scope = { companyId: { in: ["kwi", "icc"] } };
    const [, assigned] = pooledOrScoped("employeeId", "employee", scope);
    expect(assigned).toEqual({ employee: { is: scope } });
  });

  it("works for other optional relations too", () => {
    const [pooled, assigned] = pooledOrScoped("assetId", "asset", { companyId: "x" });
    expect(pooled).toEqual({ assetId: null });
    expect(assigned).toEqual({ asset: { is: { companyId: "x" } } });
  });
});

describe("allOf", () => {
  it("composes two OR conditions instead of letting one overwrite the other", () => {
    const scope = { OR: [{ employeeId: null }] };
    const search = { OR: [{ extension: { contains: "10" } }] };

    // The bug being prevented: spreading both keeps only the second.
    const spread = { ...scope, ...search };
    expect(spread.OR).toHaveLength(1);
    expect(spread.OR).toEqual(search.OR);

    const composed = allOf(scope, search);
    expect(composed.AND).toHaveLength(2);
    expect(composed.AND).toEqual([scope, search]);
  });

  it("drops absent conditions so an unfiltered call stays clean", () => {
    expect(allOf({ a: 1 }, undefined)).toEqual({ AND: [{ a: 1 }] });
    expect(allOf(undefined, undefined)).toEqual({ AND: [] });
  });
});
