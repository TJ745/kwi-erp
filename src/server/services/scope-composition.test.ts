import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against a bug that has now been found three times: the company-scope
 * helper and a search filter both emit `OR`, and spreading both into one object
 * literal drops the scope entirely, because a later `OR` key replaces an
 * earlier one. The query then runs unscoped and returns other companies' rows.
 *
 * It was fixed in the vault, then found again in listSuppliers and in the
 * supplier register report — the same mistake, written independently each time.
 * That is the signature of something a test should catch rather than a reviewer.
 *
 * This is a source scan rather than a behavioural test on purpose: the mistake
 * lives in the *shape* of a where-clause literal, which is not reachable from
 * outside the service that builds it.
 */

const SERVICES = "src/server/services";

function serviceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...serviceFiles(path));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Finds `...optionalCompanyScopeWhere(...)` followed by a spread object
 * carrying its own `OR:` before the enclosing literal closes.
 *
 * Deliberately narrow. It looks only at the span between the scope spread and
 * the next `},` at the same nesting depth, which is where a colliding `OR`
 * would have to sit to overwrite the scope.
 */
function collisions(source: string): number[] {
  const lines: number[] = [];
  const pattern = /\.\.\.optionalCompanyScopeWhere\([^)]*\),/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    // Walk forward to the end of the object literal the spread sits in.
    let depth = 0;
    let i = match.index;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        if (depth === 0) break;
        depth--;
      }
    }
    const span = source.slice(match.index, i);
    if (/\bOR:\s*\[/.test(span)) {
      lines.push(source.slice(0, match.index).split("\n").length);
    }
  }
  return lines;
}

describe("company scope is never overwritten by a search filter", () => {
  it("finds no service spreading a second OR beside optionalCompanyScopeWhere", () => {
    const offenders: string[] = [];

    for (const file of serviceFiles(SERVICES)) {
      const source = readFileSync(file, "utf8");
      for (const line of collisions(source)) {
        offenders.push(`${file}:${String(line)}`);
      }
    }

    expect(
      offenders,
      "Spread `...optionalCompanyScopeWhere(ctx)` beside another `OR:` — the " +
        "second OR replaces the scope and the query runs unscoped. Compose " +
        "them under `AND: [scope, { OR: [...] }]` instead.",
    ).toEqual([]);
  });

  it("detects the collision shape it is meant to catch", () => {
    // Proves the scanner is not vacuously passing.
    const bad = `
      const x = await prisma.supplier.findMany({
        where: {
          deletedAt: null,
          ...optionalCompanyScopeWhere(ctx),
          ...(filters.q ? { OR: [{ name: { contains: filters.q } }] } : {}),
        },
      });
    `;
    expect(collisions(bad)).toHaveLength(1);
  });

  it("accepts the AND-composed form", () => {
    const good = `
      const x = await prisma.supplier.findMany({
        where: {
          deletedAt: null,
          AND: [
            optionalCompanyScopeWhere(ctx),
            ...(filters.q ? [{ OR: [{ name: { contains: filters.q } }] }] : []),
          ],
        },
      });
    `;
    expect(collisions(good)).toEqual([]);
  });
});
