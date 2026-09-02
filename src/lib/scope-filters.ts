/**
 * Where-clause shapes that are easy to get subtly wrong.
 *
 * Free of server imports so the shapes can be asserted directly — the bugs
 * these guard against produce a query that runs happily and returns the wrong
 * rows, which no type checker will catch.
 */

/**
 * The two ways a row reached through an OPTIONAL relation can be visible:
 * unassigned (pool stock, visible to everyone) or assigned to something inside
 * the caller's scope.
 *
 * The `is:` wrapper is the whole point. Written the obvious way —
 * `{ employee: { ...scope } }` — an ALL-scope caller produces
 * `{ employee: {} }`, and Prisma DROPS an empty relation filter. Inside an
 * `OR` that deletes the entire branch, leaving only "unassigned", so an
 * administrator sees every pooled row and none of the assigned ones. Measured
 * on real data: 1 AD record in the table, 0 returned. `is: {}` states the same
 * intent in a form that survives.
 */
export function pooledOrScoped<TScope extends object>(
  foreignKey: string,
  relation: string,
  scope: TScope,
): Record<string, unknown>[] {
  return [{ [foreignKey]: null }, { [relation]: { is: scope } }];
}

/**
 * Combines independent conditions that each may contribute an `OR`.
 *
 * Spreading two `OR` keys into one object silently keeps only the last, which
 * is how a search box comes to bypass company scoping — the same defect found
 * in the vault. `AND` makes them compose instead of collide.
 */
export function allOf(
  ...conditions: (Record<string, unknown> | undefined)[]
): { AND: Record<string, unknown>[] } {
  return { AND: conditions.filter((c): c is Record<string, unknown> => c !== undefined) };
}
