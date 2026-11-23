/**
 * The organization chart, drawn the way the company draws it: a box per
 * position (job title) along its "reports to" line, with the people in it
 * underneath — by name, or for the trades (carpenters, painters, helpers) as
 * a count per company. A position nobody holds shows "Vacant".
 */

export type ChartPerson = { name: string; companyCode: string; saudi: boolean };

export type ChartPosition = {
  id: string;
  title: string;
  reportsToId: string | null;
  budgeted: number;
  people: ChartPerson[];
};

export type ChartNode = {
  id: string;
  title: string;
  /** Names, for most positions. */
  people: ChartPerson[];
  /** Counts per company (and Saudis apart), for the trades. */
  counts: { label: string; companyCode: string; count: number }[] | null;
  vacant: boolean;
  children: ChartNode[];
};

/** Trades are counted, not named: carpenters, painters, helpers (not their foremen). */
export function isCountedPosition(title: string): boolean {
  return /carpenter|painter|helper/i.test(title) && !/foreman|supervisor|manager/i.test(title);
}

function countsFor(people: ChartPerson[]) {
  const map = new Map<string, { label: string; companyCode: string; count: number }>();
  for (const p of people) {
    const key = `${p.companyCode}${p.saudi ? ":SA" : ""}`;
    const row = map.get(key) ?? {
      label: p.saudi ? `Saudi (${p.companyCode})` : `(${p.companyCode})`,
      companyCode: p.companyCode,
      count: 0,
    };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort(
    (a, b) => a.companyCode.localeCompare(b.companyCode) || a.label.localeCompare(b.label),
  );
}

/**
 * Builds the tree. A position is drawn when someone holds it, when seats are
 * budgeted for it, or when it sits in the structure (it reports to something
 * or something reports to it) — the designed structure shows its vacancies.
 * A "reports to" chain that loops is cut where it loops.
 */
export function buildPositionTree(positions: ChartPosition[]): ChartNode[] {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const childrenOf = new Map<string, ChartPosition[]>();
  for (const p of positions) {
    if (p.reportsToId && byId.has(p.reportsToId)) {
      const list = childrenOf.get(p.reportsToId) ?? [];
      list.push(p);
      childrenOf.set(p.reportsToId, list);
    }
  }

  const inStructure = (p: ChartPosition) =>
    p.people.length > 0 ||
    p.budgeted > 0 ||
    (p.reportsToId !== null && byId.has(p.reportsToId)) ||
    (childrenOf.get(p.id)?.length ?? 0) > 0;

  function build(p: ChartPosition, seen: Set<string>): ChartNode | null {
    if (seen.has(p.id)) return null;
    const nextSeen = new Set(seen).add(p.id);
    const children = (childrenOf.get(p.id) ?? [])
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((c) => build(c, nextSeen))
      .filter((c): c is ChartNode => c !== null);
    if (!inStructure(p) && children.length === 0) return null;
    const counted = isCountedPosition(p.title);
    return {
      id: p.id,
      title: p.title,
      people: counted ? [] : [...p.people].sort((a, b) => a.name.localeCompare(b.name)),
      counts: counted && p.people.length > 0 ? countsFor(p.people) : null,
      vacant: p.people.length === 0 || p.people.length < p.budgeted,
      children,
    };
  }

  // Roots: positions whose "reports to" is unset, unknown, or part of a loop.
  const roots = positions.filter((p) => !p.reportsToId || !byId.has(p.reportsToId));
  const placed = new Set<string>();
  const mark = (n: ChartNode) => {
    placed.add(n.id);
    n.children.forEach(mark);
  };
  const tree = roots
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => build(r, new Set()))
    .filter((n): n is ChartNode => n !== null);
  tree.forEach(mark);
  // A loop has no root of its own; draw it from its first member.
  for (const p of positions) {
    if (placed.has(p.id)) continue;
    const n = build(p, new Set());
    if (n) {
      tree.push(n);
      mark(n);
    }
  }
  // The biggest structure first, so the main tree leads.
  const size = (n: ChartNode): number => 1 + n.children.reduce((s, c) => s + size(c), 0);
  return tree.sort((a, b) => size(b) - size(a));
}

/** Box colours per company, like the paper chart: KWI blue, ICC yellow. */
const PALETTE: Record<string, string> = {
  KWI: "#b4c6e7",
  ICC: "#ffff00",
  KMI: "#c6e0b4",
  SAR: "#e2c6f0",
};
const SPARE = ["#ffd966", "#9bc2e6", "#f4b183", "#a9d08e"];

export function companyColour(code: string, codes: readonly string[]): string {
  return PALETTE[code] ?? SPARE[codes.indexOf(code) % SPARE.length] ?? "#e7e6e6";
}

export const VACANT_COLOUR = "#f8cbad";
export const TITLE_COLOUR = "#a9d08e";
