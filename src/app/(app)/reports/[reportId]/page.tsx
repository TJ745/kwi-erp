import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { formatCell } from "@/lib/export";
import { isReportId, visibleColumns } from "@/lib/reports";
import { requirePagePermission } from "@/server/auth/page-guards";
import { runReport } from "@/server/services/reports";
import { parseReportFilters, describeFilters } from "@/server/services/report-filters";
import { orgOptions } from "@/server/services/org";
import { ReportFilterBar } from "./report-filter-bar";
import { ExportButtons } from "./export-buttons";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Report" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("reports.view");
  const { reportId } = await params;
  if (!isReportId(reportId)) notFound();

  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") query.set(key, value);
  }
  const filters = parseReportFilters(query);

  // A report the actor may not open must look missing, not barred.
  const result = await runReport(ctx, reportId, filters).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  // The same derivation the export route uses. That is the point of it living
  // in lib/reports.ts rather than in either of these two files.
  const columns = visibleColumns(result.spec, ctx.permissions);
  const canExport = ctx.permissions.has("reports.export");
  const options = await orgOptions(ctx);
  const filterSummary = describeFilters(filters);

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 p-6">
      <div className="print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports">
                <ArrowLeft />
                All reports
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{result.spec.name}</h1>
              <p className="text-muted-foreground max-w-2xl text-xs">
                {result.spec.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PrintButton />
            {canExport ? (
              <ExportButtons reportId={reportId} query={query.toString()} />
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <ReportFilterBar
            reportId={reportId}
            filters={result.spec.filters}
            companies={options.companies}
            departments={options.departments}
            current={Object.fromEntries(query)}
          />
        </div>
      </div>

      {/* Print-only provenance: a printed page with no context is how stale
          numbers end up quoted as current. */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">{result.spec.name}</h1>
        <p className="text-xs">
          Generated {result.generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC by{" "}
          {ctx.name} · {filterSummary || "no filters"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {result.rows.length} {result.rows.length === 1 ? "row" : "rows"}
        </span>
        {filterSummary ? (
          <span className="text-muted-foreground">{filterSummary}</span>
        ) : null}
        {result.truncated ? (
          <span className="text-status-warning" role="status">
            Showing the first {result.rows.length} rows — narrow the filters to see the rest.
          </span>
        ) : null}
      </div>

      {result.rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No rows match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border print:overflow-visible print:border-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-3 py-2 font-medium whitespace-nowrap ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="border-t">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-1.5 ${
                        column.align === "right" ? "text-right tabular-nums" : "text-left"
                      }`}
                    >
                      {/* React escapes this; formatCell only normalises dates,
                          booleans, and nulls into display text. */}
                      {formatCell(row[column.key]) || (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
