import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { recordAudit } from "@/server/audit/log";
import { logger } from "@/server/logger";
import { safeFilename, toCsv, type ExportColumn } from "@/lib/export";
import {
  auditEntriesForExport,
  AUDIT_EXPORT_LIMIT,
  type AuditFilters,
} from "@/server/services/platform";

export const runtime = "nodejs";

type AuditExportRow = {
  id: string;
  createdAt: Date;
  actorLabel: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  companyId: string | null;
  summary: string;
  changes: unknown;
  ipAddress: string | null;
};

/**
 * Audit log export — the `audit.export` permission, which until now nothing
 * used.
 *
 * Three things make this more sensitive than a report export, and each is
 * handled rather than assumed away:
 *
 *   1. It is a bulk copy of the record of everything anyone has done, so it
 *      gets its own, tighter rate limit.
 *   2. Exporting the audit log is itself an auditable event, and one that must
 *      appear IN the log being exported. It is recorded after the rows are
 *      read, so the export never contains its own entry — which would be
 *      confusing rather than wrong.
 *   3. `changes` can contain salary figures: SECURITY.md §7 records the
 *      deliberate decision not to redact those, because an approval record
 *      that hides the amount is useless. `audit.export` is therefore only ever
 *      granted alongside `employees.salary.view`, and the same coupling that
 *      governs `audit.view` governs this route.
 *
 * Company scope comes from the same `auditWhere` the on-screen list uses, so
 * an export cannot reach rows the screen would hide.
 */
export async function GET(request: NextRequest) {
  const ctx = await getActorContext();
  if (!ctx) return deny(401, "Not signed in.");

  // 404 rather than 403: someone without the permission learns nothing about
  // whether the route exists.
  if (!ctx.permissions.has("audit.export")) return deny(404, "Not found.");

  try {
    await consumeRateLimit("auditExport", ctx.userId);
  } catch {
    return deny(429, "Too many exports. Please try again later.");
  }

  const url = new URL(request.url);
  const filters: AuditFilters = {
    ...textParam(url, "action"),
    ...textParam(url, "entityType"),
    ...textParam(url, "entityId"),
    ...textParam(url, "actorUserId"),
    ...textParam(url, "companyId"),
    ...textParam(url, "q"),
    ...dateParam(url, "from"),
    ...dateParam(url, "to"),
  };

  let result;
  try {
    result = await auditEntriesForExport(ctx, filters);
  } catch (error) {
    const reference = crypto.randomUUID().slice(0, 8);
    logger.error("Audit export failed", {
      reference,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    });
    return deny(500, `Export failed. Reference ${reference}.`);
  }

  const csv = toCsv(COLUMNS, result.entries);

  await recordAudit(ctx, {
    action: "EXPORT",
    entityType: "USER",
    entityId: ctx.userId,
    summary:
      `Exported the audit log — ${String(result.entries.length)} entries` +
      (result.truncated ? ` (capped at ${String(AUDIT_EXPORT_LIMIT)})` : ""),
    after: {
      rowCount: result.entries.length,
      truncated: result.truncated,
      filters: describe(filters),
    },
  });

  const filename = safeFilename(`Audit log ${new Date().toISOString().slice(0, 10)}`, "csv");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A snapshot of live data, and scoped to this actor: a cached copy served
      // to anyone else would be a scope violation.
      "Cache-Control": "no-store, private",
      // Surfaced as a header so a truncated export is detectable by whatever
      // consumes it, not only by the person reading the audit entry.
      "X-Export-Truncated": String(result.truncated),
    },
  });
}

const COLUMNS: ExportColumn<AuditExportRow>[] = [
  { key: "createdAt", header: "When", value: (r) => r.createdAt.toISOString() },
  { key: "actorLabel", header: "Actor", value: (r) => r.actorLabel },
  { key: "action", header: "Action", value: (r) => r.action },
  { key: "entityType", header: "Entity type", value: (r) => r.entityType },
  { key: "entityId", header: "Entity id", value: (r) => r.entityId },
  { key: "summary", header: "Summary", value: (r) => r.summary },
  {
    key: "changes",
    header: "Changes",
    // Already redacted on write — `recordAudit` routes every diff through
    // `diffRecords`, so a redacted field is stored as the placeholder and this
    // does no filtering of its own (see audit/redact.ts).
    value: (r) => (r.changes === null ? null : JSON.stringify(r.changes)),
  },
  { key: "ipAddress", header: "IP address", value: (r) => r.ipAddress },
];

/** Present only when non-empty, for `exactOptionalPropertyTypes`. */
function textParam(url: URL, key: string): Record<string, string> {
  const value = url.searchParams.get(key)?.trim();
  return value ? { [key]: value } : {};
}

function dateParam(url: URL, key: string): Record<string, Date> {
  const raw = url.searchParams.get(key);
  if (!raw) return {};
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? {} : { [key]: date };
}

function describe(filters: AuditFilters): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString().slice(0, 10) : String(v)}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function deny(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
