import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { buildOrgChart, orgChartStats, type OrgNode } from "@/server/services/org-chart";

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

  return (
    <PageShell>
      <PageHeader
        title="Organisation Chart"
        description="Reporting lines from each employee's manager. Someone whose manager is outside the companies you can see appears as a root here."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="People shown" value={chart.total} />
        <StatCard label="Top-level" value={stats.roots} />
        <StatCard label="With reports" value={stats.managers} />
        <StatCard label="Deepest level" value={stats.deepest} />
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

      {chart.roots.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No employees to chart"
          description="Active employees with reporting lines appear here."
        />
      ) : (
        <div className="space-y-2">
          {chart.roots.map((node) => (
            <OrgBranch key={node.id} node={node} depth={0} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

/**
 * One node and its reports.
 *
 * Rendered as nested lists rather than an SVG diagram: it stays readable at any
 * depth, works on a phone, prints, and is navigable by screen reader — none of
 * which a hand-drawn box tree manages without a great deal more code.
 */
function OrgBranch({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <div className={depth > 0 ? "border-muted ml-4 border-l pl-4" : undefined}>
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <Link
          href={`/people/employees/${node.id}`}
          className="text-sm font-medium hover:underline"
        >
          {node.fullName}
        </Link>
        <span className="text-muted-foreground text-xs">
          {node.employeeNo}
          {node.positionTitle ? ` · ${node.positionTitle}` : ""}
          {node.departmentName ? ` · ${node.departmentName}` : ""}
          {` · ${node.companyCode}`}
        </span>
        {node.status !== "ACTIVE" ? (
          <Badge variant="outline" className="text-xs">
            {node.status.replace(/_/g, " ").toLowerCase()}
          </Badge>
        ) : null}
        {node.reports.length > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            ({node.reports.length})
          </span>
        ) : null}
      </div>

      {node.reports.map((child) => (
        <OrgBranch key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
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
