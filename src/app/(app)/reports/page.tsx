import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { visibleReports } from "@/lib/reports";
import { requirePagePermission } from "@/server/auth/page-guards";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requirePagePermission("reports.view");

  // Filtered server-side: a report the actor cannot open is never rendered,
  // so the list is not a catalogue of what to go looking for.
  const reports = visibleReports(ctx.permissions);

  const byModule = new Map<string, typeof reports>();
  for (const report of reports) {
    byModule.set(report.module, [...(byModule.get(report.module) ?? []), report]);
  }

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description="Filtered, exportable views across every module. Columns you are not permitted to see are omitted from both the screen and the export."
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No reports available"
          description="Your role does not include access to any report."
        />
      ) : (
        [...byModule.entries()].map(([module, moduleReports]) => (
          <section key={module} className="space-y-3">
            <h2 className="text-sm font-semibold">{module}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {moduleReports.map((report) => (
                <Link key={report.id} href={`/reports/${report.id}`}>
                  <Card className="hover:border-foreground/20 h-full gap-0 py-4 transition-colors">
                    <CardContent className="flex h-full gap-3 px-4">
                      <FileSpreadsheet
                        className="text-muted-foreground mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {report.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </PageShell>
  );
}
