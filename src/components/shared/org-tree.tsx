import Link from "next/link";
import type { OrgNode } from "@/server/services/org-chart";
import { cn } from "@/lib/utils";

/**
 * The organisation chart as a chart — boxes and connectors, not an indented
 * list.
 *
 * Each node is two stacked bands, matching how the company's own chart reads:
 * the ROLE on top and the PERSON filling it underneath. That ordering is the
 * point of an org chart — the structure is the stable thing and the occupant
 * is what changes — and it is what makes a vacancy expressible at all.
 *
 * Company colour comes from the validated categorical palette by index rather
 * than by hard-coded company code, so a third company (KMI already exists)
 * gets a distinct colour without a code change, and the colours keep the CVD
 * separation those tokens were chosen for.
 */

export type CompanyColours = Map<string, string>;

/** Assigns each company a palette slot, deterministically by code. */
export function assignCompanyColours(codes: readonly string[]): CompanyColours {
  const slots = [
    "var(--chart-cat-1)",
    "var(--chart-cat-2)",
    "var(--chart-cat-3)",
    "var(--chart-cat-4)",
  ];
  const sorted = [...new Set(codes)].sort();
  return new Map(
    sorted.map((code, i) => [code, slots[i] ?? "var(--chart-cat-other)"]),
  );
}

export function OrgTree({
  roots,
  colours,
}: {
  roots: OrgNode[];
  colours: CompanyColours;
}) {
  return (
    // The chart is as wide as the organisation is, which is wider than any
    // screen once there are eight departments. It scrolls in its own box so
    // the page around it never does.
    <div className="org-tree overflow-x-auto rounded-lg border p-6">
      <ul className="org-level org-level--roots">
        {roots.map((root) => (
          <OrgSubtree key={root.id} node={root} colours={colours} />
        ))}
      </ul>
    </div>
  );
}

/**
 * One node and its children, as a list item.
 *
 * A real `ul`/`li` rather than divs: the connectors are drawn on the item
 * itself (`::before`/`::after` as the two halves of the bar above it), which
 * only works if the node box and the child list are SIBLINGS inside one
 * positioned item. It also means the chart is still a nested list to a screen
 * reader, which is the one reading of an org chart that never needs lines.
 */
function OrgSubtree({ node, colours }: { node: OrgNode; colours: CompanyColours }) {
  const groups = groupReports(node.reports);

  return (
    <li className="org-item">
      <NodeBox node={node} colours={colours} />

      {groups.length > 0 ? (
        <ul className="org-level">
          {groups.map((group) =>
            group.kind === "single" ? (
              <OrgSubtree key={group.key} node={group.node} colours={colours} />
            ) : (
              <li key={group.key} className="org-item">
                <RollupBox group={group} colours={colours} />
              </li>
            ),
          )}
        </ul>
      ) : null}
    </li>
  );
}

type ReportGroup =
  | { kind: "single"; key: string; node: OrgNode }
  | {
      kind: "rollup";
      key: string;
      title: string;
      members: OrgNode[];
      byCompany: { code: string; count: number }[];
    };

/**
 * Collapses repeated leaf roles into one counted box.
 *
 * Twenty-three carpenters reporting to the same foreman is twenty-three
 * identical boxes that say nothing and push the rest of the chart off the
 * page. The printed chart the company already uses solves this the same way —
 * one "Carpenter" box reading 34 (KWI) / 7 (ICC) — so the chart stays about
 * structure and the names live on the employee list.
 *
 * Only LEAVES are grouped. Anyone with reports of their own is a branch of the
 * structure and always keeps their own box, however common their title.
 */
function groupReports(reports: OrgNode[]): ReportGroup[] {
  const out: ReportGroup[] = [];
  const leafBuckets = new Map<string, OrgNode[]>();

  for (const report of reports) {
    const title = report.positionTitle;
    // No title means nothing to group by; a manager is never grouped; and a
    // vacancy is never grouped, because an empty seat hidden inside a count is
    // an empty seat nobody sees.
    if (report.reports.length > 0 || !title || report.vacant) {
      out.push({ kind: "single", key: report.id, node: report });
      continue;
    }
    const bucket = leafBuckets.get(title);
    if (bucket) bucket.push(report);
    else leafBuckets.set(title, [report]);
  }

  for (const [title, members] of leafBuckets) {
    const first = members[0];
    if (members.length === 1 && first) {
      out.push({ kind: "single", key: first.id, node: first });
      continue;
    }

    const counts = new Map<string, number>();
    for (const m of members) counts.set(m.companyCode, (counts.get(m.companyCode) ?? 0) + 1);

    out.push({
      kind: "rollup",
      key: `rollup:${title}`,
      title,
      members,
      byCompany: [...counts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    });
  }

  return out;
}

/** One box standing for several people in the same role. */
function RollupBox({
  group,
  colours,
}: {
  group: Extract<ReportGroup, { kind: "rollup" }>;
  colours: CompanyColours;
}) {
  // The box is tinted by the company contributing most of the headcount, so a
  // mixed role still reads as predominantly one entity at a glance.
  const dominant = [...group.byCompany].sort((a, b) => b.count - a.count)[0];
  const accent = colours.get(dominant?.code ?? "") ?? "var(--chart-cat-other)";

  return (
    <div className="org-node">
      <div
        className="rounded-t-md border border-b-0 px-2 py-1 text-center text-[11px] leading-tight font-semibold"
        style={{
          background: `color-mix(in oklch, ${accent} 14%, var(--background))`,
          borderColor: `color-mix(in oklch, ${accent} 35%, var(--border))`,
        }}
      >
        {group.title}
      </div>
      <div
        className="space-y-0.5 rounded-b-md border px-2 py-1 text-center"
        style={{ borderColor: `color-mix(in oklch, ${accent} 35%, var(--border))` }}
      >
        {group.byCompany.map((c) => (
          <p key={c.code} className="text-[11px] leading-tight font-medium tabular-nums">
            <span
              aria-hidden="true"
              className="mr-1 inline-block size-1.5 rounded-full align-middle"
              style={{ background: colours.get(c.code) ?? "var(--chart-cat-other)" }}
            />
            {c.count} ({c.code})
          </p>
        ))}
      </div>
    </div>
  );
}

function NodeBox({ node, colours }: { node: OrgNode; colours: CompanyColours }) {
  const accent = colours.get(node.companyCode) ?? "var(--chart-cat-other)";
  const inactive = node.status !== "ACTIVE";

  return (
    <div className={cn("org-node", inactive && "org-node--vacant")}>
      {/* Role band. Kept even when the position is unset, so every box has the
          same shape and the tree reads as a grid of roles. */}
      <div
        className="rounded-t-md border border-b-0 px-2 py-1 text-center text-[11px] leading-tight font-semibold"
        style={{
          background: `color-mix(in oklch, ${accent} 14%, var(--background))`,
          borderColor: `color-mix(in oklch, ${accent} 35%, var(--border))`,
        }}
      >
        {node.positionTitle ?? "—"}
      </div>

      {/* Person band. */}
      <div
        className="org-node-name rounded-b-md border px-2 py-1 text-center"
        style={{
          borderColor: `color-mix(in oklch, ${accent} 35%, var(--border))`,
        }}
      >
        {node.vacant ? (
          // No link: there is no record behind a vacancy, and a dead link on
          // an org chart is how people conclude the chart is broken.
          <p className="text-muted-foreground text-[11px] leading-tight font-medium italic">
            Vacant
          </p>
        ) : (
          <Link
            href={`/people/employees/${node.id}`}
            className="text-[11px] leading-tight font-medium hover:underline"
          >
            {node.fullName}
          </Link>
        )}
        <p className="text-muted-foreground text-[10px] leading-tight">
          <span
            aria-hidden="true"
            className="mr-1 inline-block size-1.5 rounded-full align-middle"
            style={{ background: accent }}
          />
          {node.companyCode}
          {node.reports.length > 0 ? ` · ${String(node.reports.length)}` : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * Company legend and headcount, mirroring the tally box on the printed chart.
 *
 * Counts come from the rendered tree rather than a separate query, so the
 * legend can never disagree with the boxes above it — a chart whose total
 * contradicts its own contents is worse than one with no total.
 */
export function OrgLegend({
  counts,
  colours,
}: {
  counts: { code: string; count: number }[];
  colours: CompanyColours;
}) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-3">
      {counts.map((c) => (
        <div key={c.code} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-3 rounded-sm"
            style={{
              background: `color-mix(in oklch, ${
                colours.get(c.code) ?? "var(--chart-cat-other)"
              } 30%, var(--background))`,
              border: `1px solid ${colours.get(c.code) ?? "var(--chart-cat-other)"}`,
            }}
          />
          <span className="font-medium">{c.code}</span>
          <span className="tabular-nums">{c.count}</span>
        </div>
      ))}
      <div className="text-muted-foreground ml-auto text-sm">
        Total shown <span className="text-foreground font-medium tabular-nums">{total}</span>
      </div>
    </div>
  );
}
