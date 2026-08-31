import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Network } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { buildOrgChart, orgChartStats, type OrgNode } from "@/server/services/org-chart";
import {
  assignCompanyColours,
  OrgLegend,
  OrgTree,
} from "@/components/shared/org-tree";

export const metadata: Metadata = { title: "Organisation Chart" };

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const ctx = await requirePagePermission("employees.view");
  const { companyId } = await searchParams;

  const chart = await buildOrgChart(ctx, { ...(companyId ? { companyId } : {}) });
  const stats = orgChartStats(chart);

  // Counted from the tree itself rather than queried separately, so the legend
  // cannot disagree with the boxes it sits under.
  const byCompany = new Map<string, number>();
  const tally = (node: OrgNode): void => {
    // Vacancies are seats, not headcount. Counting them here would invent a
    // company for a role that has no holder — and inflate the total with
    // people who do not exist. They have their own KPI above.
    if (!node.vacant) {
      byCompany.set(node.companyCode, (byCompany.get(node.companyCode) ?? 0) + 1);
    }
    for (const child of node.reports) tally(child);
  };
  for (const root of chart.roots) tally(root);

  const counts = [...byCompany.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const colours = assignCompanyColours(counts.map((c) => c.code));

  return (
    <PageShell>
      <PageHeader
        title="Organisation Chart"
        description="Reporting lines from each employee's manager. Someone whose manager is outside the companies you can see appears as a root here."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="People shown" value={chart.total} />
        <StatCard label="Top-level" value={stats.roots} />
        <StatCard label="With reports" value={stats.managers} />
        <StatCard label="Deepest level" value={stats.deepest} />
        <StatCard label="Vacant seats" value={chart.vacancies} />
      </div>

      {chart.cycles.length > 0 ? (
        <div
          role="alert"
          className="border-status-expired/40 bg-status-expired/5 rounded-md border p-3"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {chart.cycles.length} reporting cycle
            {chart.cycles.length === 1 ? "" : "s"} detected
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Following the manager chain for these people leads back to themselves, so
            they are shown at the top level instead. Fix the manager on their record.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {chart.cycles.map((c) => (
              <li key={c.id}>
                <Link href={`/people/employees/${c.id}`} className="hover:underline">
                  {c.fullName} ({c.employeeNo})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {chart.unplaced.length > 0 ? (
        <div className="border-status-warning/40 bg-status-warning/5 rounded-md border p-3">
          <p className="text-sm font-medium">
            {chart.unplaced.length} budgeted role
            {chart.unplaced.length === 1 ? "" : "s"} could not be placed on the chart
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            These have budgeted seats but nobody in them, and no “reports to” role set — so
            there is nowhere to draw them. Set the reporting role on the position to place
            them.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {chart.unplaced.map((u) => (
              <li key={`${u.positionTitle}:${u.companyCode ?? ""}`}>
                {u.positionTitle}
                {u.companyCode ? ` (${u.companyCode})` : ""} — {u.seats} seat
                {u.seats === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {chart.roots.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No employees to chart"
          description="Active employees with reporting lines appear here."
        />
      ) : (
        <>
          <OrgLegend counts={counts} colours={colours} />
          <OrgTree roots={chart.roots} colours={colours} />
        </>
      )}
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
