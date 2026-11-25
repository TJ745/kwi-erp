import type { Metadata } from "next";
import Link from "next/link";
import { Network, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { ChartTotals, PositionChart } from "@/components/shared/position-chart";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { positionChart } from "@/server/services/org-chart";

export const metadata: Metadata = { title: "Organization Chart" };

/** `?c=id1,id2` — the companies on the chart; none means all. */
function parseCompanies(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const ctx = await requirePagePermission("employees.view");
  const { c } = await searchParams;
  const selected = parseCompanies(c);
  const chart = await positionChart(ctx, selected);
  const codes = chart.companies.map((x) => x.code);
  const query = selected.length ? `?c=${selected.join(",")}` : "";

  // A company chip adds or removes that company from the selection.
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    return `/people/org-chart${next.length ? `?c=${next.join(",")}` : ""}`;
  };

  return (
    <PageShell>
      <PageHeader
        title="Organization Chart"
        description="Positions along their reporting lines, with the people in each. The structure comes from each position's “Reports to” in Settings → Departments."
        action={
          <Button asChild variant="outline">
            <Link href={`/people/org-chart/print${query}`} target="_blank" rel="noopener">
              <Printer />
              Print
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs">Companies</span>
        <Link
          href="/people/org-chart"
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs",
            selected.length === 0
              ? "bg-primary text-primary-foreground border-transparent"
              : "hover:bg-accent text-muted-foreground",
          )}
        >
          All
        </Link>
        {chart.companies.map((co) => (
          <Link
            key={co.id}
            href={toggle(co.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              selected.includes(co.id)
                ? "bg-primary text-primary-foreground border-transparent"
                : "hover:bg-accent text-muted-foreground",
            )}
          >
            {co.code}
          </Link>
        ))}
      </div>

      {chart.tree.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No structure yet"
          description="Give positions a “Reports to” in Settings → Departments, and employees a position."
        />
      ) : (
        <>
          <div className="overflow-auto rounded-lg border bg-white p-4">
            <div className="w-max">
              <PositionChart tree={chart.tree} codes={codes} />
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-muted-foreground max-w-xl text-xs">
              Carpenters, painters and helpers show as a count per company (Saudis apart); other
              positions list their people. A position nobody holds shows Vacant.
              {chart.unplaced > 0
                ? ` ${String(chart.unplaced)} active employee(s) have no position and are not on the chart.`
                : ""}
            </p>
            <ChartTotals totals={chart.totals} total={chart.total} codes={codes} />
          </div>
        </>
      )}
    </PageShell>
  );
}
