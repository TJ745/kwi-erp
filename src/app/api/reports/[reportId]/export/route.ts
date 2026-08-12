import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { recordAudit } from "@/server/audit/log";
import { logger } from "@/server/logger";
import { AppError } from "@/lib/result";
import { safeFilename, toCsv, type ExportColumn } from "@/lib/export";
import { isReportId, visibleColumns, type ReportColumnSpec } from "@/lib/reports";
import { runReport, type ReportRow } from "@/server/services/reports";
import { buildWorkbook } from "@/server/export/workbook";
import { parseReportFilters, describeFilters } from "@/server/services/report-filters";

export const runtime = "nodejs";

/**
 * Report export — brief §36, SECURITY.md §3.
 *
 * A route handler rather than a Server Action because the response is a file,
 * not JSON. That makes it a second read path over every domain table, which is
 * precisely the shape of the leak Phase 11 shipped, so:
 *
 *   - both permission gates run here, not only in the page that links here;
 *   - columns come from `visibleColumns`, the same function the screen uses,
 *     so an export can never contain a column the screen omits;
 *   - the service does not select gated fields at all, so even a bug here
 *     could not surface a salary;
 *   - every export is audited with the row count and the columns included.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> },
) {
  const ctx = await getActorContext();
  if (!ctx) return deny(401, "Not signed in.");

  const { reportId } = await context.params;
  // Validated against the catalogue before touching anything else — reportId
  // reaches a filename below.
  if (!isReportId(reportId)) return deny(404, "Report not found.");

  if (!ctx.permissions.has("reports.export")) return deny(404, "Report not found.");

  // An export is far more expensive than a page view and far more useful to
  // someone bulk-collecting data.
  try {
    await consumeRateLimit("reportExport", ctx.userId);
  } catch {
    return deny(429, "Too many exports. Please try again later.");
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters = parseReportFilters(url.searchParams);

  let result;
  try {
    result = await runReport(ctx, reportId, filters);
  } catch (error) {
    // A permission failure inside the service must look like a missing report,
    // not like a report that exists but is barred.
    if (error instanceof AppError) return deny(404, "Report not found.");

    const reference = crypto.randomUUID().slice(0, 8);
    logger.error("Report export failed", {
      reference,
      reportId,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    });
    return deny(500, `Export failed. Reference ${reference}.`);
  }

  // The one derivation, shared with the on-screen table.
  const columns = visibleColumns(result.spec, ctx.permissions);
  const filterSummary = describeFilters(filters);

  await recordAudit(ctx, {
    action: "EXPORT",
    entityType: "COMPANY",
    entityId: filters.companyId ?? "ALL",
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    summary: `Exported "${result.spec.name}" as ${format.toUpperCase()} — ${String(result.rows.length)} rows`,
    // Which columns left the system is the question asked after an incident.
    // The rows themselves are deliberately not recorded.
    after: {
      report: reportId,
      format,
      rowCount: result.rows.length,
      columns: columns.map((c) => c.key),
      filters: filterSummary || "none",
      truncated: result.truncated,
    },
  });

  const filename = safeFilename(
    `${result.spec.name} ${result.generatedAt.toISOString().slice(0, 10)}`,
    format,
  );

  if (format === "xlsx") {
    const workbook = await buildWorkbook(result.spec.name, columns, result.rows, {
      generatedAt: result.generatedAt,
      generatedBy: `${ctx.name} <${ctx.email}>`,
      filters: filterSummary,
    });

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // An export is a point-in-time snapshot of live data; a cached copy
        // served to a different user would also be a scope violation.
        "Cache-Control": "no-store, private",
      },
    });
  }

  const csv = toCsv(toCsvColumns(columns), result.rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
    },
  });
}

function toCsvColumns(columns: readonly ReportColumnSpec[]): ExportColumn<ReportRow>[] {
  return columns.map((column) => ({
    key: column.key,
    header: column.header,
    value: (row) => row[column.key] ?? null,
  }));
}

function deny(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
