import "server-only";
import type { ReportFilters } from "./reports";

/**
 * Parses report filters from a URL.
 *
 * Shared by the page and the export route so a link and its export button
 * cannot disagree about what was filtered — an export whose filters silently
 * differ from the screen is worse than one that fails.
 *
 * Everything here is hostile input. Ids are length-bounded and shape-checked
 * rather than trusted; dates that do not parse are dropped rather than
 * defaulted, because a silently ignored `from` returns more rows than asked
 * for, not fewer.
 */

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;
const STATUS_PATTERN = /^[A-Z_]{1,40}$/;

function readId(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value && ID_PATTERN.test(value) ? value : undefined;
}

function readDate(params: URLSearchParams, key: string): Date | undefined {
  const value = params.get(key)?.trim();
  if (!value) return undefined;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const companyId = readId(params, "companyId");
  const departmentId = readId(params, "departmentId");
  const status = params.get("status")?.trim();
  const from = readDate(params, "from");
  const to = readDate(params, "to");
  const q = params.get("q")?.trim().slice(0, 100);

  return {
    ...(companyId ? { companyId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(status && STATUS_PATTERN.test(status) ? { status } : {}),
    ...(from ? { from } : {}),
    // Inclusive: a "to" of 2026-03-31 must include everything that day, not
    // stop at midnight and quietly drop the last day of the month.
    ...(to ? { to: new Date(to.getTime() + 86_399_999) } : {}),
    ...(q ? { q } : {}),
  };
}

/** Human-readable summary, written into the export header and the audit row. */
export function describeFilters(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.companyId) parts.push("company filtered");
  if (filters.departmentId) parts.push("department filtered");
  if (filters.status) parts.push(`status = ${filters.status}`);
  if (filters.from) parts.push(`from ${filters.from.toISOString().slice(0, 10)}`);
  if (filters.to) parts.push(`to ${filters.to.toISOString().slice(0, 10)}`);
  if (filters.q) parts.push(`search "${filters.q}"`);
  return parts.join(", ");
}
