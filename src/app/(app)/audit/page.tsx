import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { PRINT_PAGE_SIZE } from "@/lib/list-query";
import {
  auditActors,
  auditCounts,
  listAuditEntries,
} from "@/server/services/platform";
import { AuditFilters } from "./audit-filters";
import { AuditChanges } from "./audit-changes";

export const metadata: Metadata = { title: "Audit Log" };

/** Destructive and disclosive actions read differently from routine ones. */
const ACTION_TONE: Record<string, "default" | "outline" | "destructive" | "secondary"> = {
  DELETE: "destructive",
  EXPORT: "destructive",
  REVEAL: "destructive",
  CREATE: "default",
  UPDATE: "outline",
  APPROVE: "secondary",
  REJECT: "secondary",
  LOGIN: "outline",
  DOWNLOAD: "secondary",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entityType?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: string;
    print?: string;
  }>;
}) {
  const ctx = await requirePagePermission("audit.view");
  const params = await searchParams;

  const page = Number(params.page ?? "1");
  const filters = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
    ...(params.q ? { q: params.q } : {}),
    ...(params.from ? { from: new Date(`${params.from}T00:00:00.000Z`) } : {}),
    ...(params.to ? { to: new Date(`${params.to}T23:59:59.999Z`) } : {}),
  };

  // The export link carries the same filters, so what downloads is what the
  // screen shows rather than the whole log.
  const canExport = ctx.permissions.has("audit.export");
  // Printing the whole filtered log is an export in all but name, so it sits
  // behind the same permission.
  const printAll = canExport && params.print === "1";
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] =>
        entry[0] !== "page" && entry[0] !== "print" && Boolean(entry[1]),
    ),
  ).toString();

  const [result, actors, counts] = await Promise.all([
    printAll
      ? listAuditEntries(ctx, filters, 1, PRINT_PAGE_SIZE)
      : listAuditEntries(ctx, filters, Number.isFinite(page) ? page : 1),
    auditActors(ctx),
    auditCounts(ctx),
  ]);

  const queryFor = (nextPage: number): string => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value && key !== "page" && key !== "print") qs.set(key, value);
    }
    qs.set("page", String(nextPage));
    return `?${qs.toString()}`;
  };

  return (
    <PageShell>
      <PageHeader
        title="Audit Log"
        printable={canExport}
        description="Who did what, and when. Entries are written by the system and can never be edited or deleted from here — that is what makes the trail worth having."
        action={
          canExport ? (
            <a
              // A link, not an action: the response is a file. It carries the
              // current filters so the export matches what is on screen.
              href={`/api/audit/export${exportQuery ? `?${exportQuery}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download />
              Export CSV
            </a>
          ) : null
        }
      />

      {/* Passwords, keys, and IBANs are masked at write time. Salary figures
          are not — see SECURITY.md §7 for why, and for the permission coupling
          that follows from it. */}
      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
        Credentials and bank details are masked in this trail. Salary figures are
        <strong className="font-medium"> not</strong> masked, because an approval record
        that hides the amount cannot answer what it exists for — so access here should
        only be granted alongside permission to see salaries.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-print-hide>
        <StatCard label="Entries visible" value={counts.total} />
        <StatCard label="Last 24 hours" value={counts.today} />
        <StatCard label="Deletions today" value={counts.deletes} tone="warning" />
        <StatCard label="Exports today" value={counts.exports} tone="warning" />
      </div>

      <AuditFilters
        actors={actors}
        current={{
          action: params.action ?? "",
          entityType: params.entityType ?? "",
          actorUserId: params.actorUserId ?? "",
          from: params.from ?? "",
          to: params.to ?? "",
          q: params.q ?? "",
        }}
      />

      {result.entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No matching entries"
          description="Adjust the filters, or widen the date range."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">When</th>
                  <th className="px-3 py-2 text-left font-medium">Who</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">What</th>
                  <th className="px-3 py-2 text-left font-medium">Entity</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.entries.map((e) => (
                  <tr key={e.id} className="border-t align-top">
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap tabular-nums">
                      {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2">
                      <p>{e.actorLabel}</p>
                      {e.ipAddress ? (
                        <p className="text-muted-foreground font-mono text-xs">
                          {e.ipAddress}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={ACTION_TONE[e.action] ?? "outline"}>{e.action}</Badge>
                    </td>
                    <td className="max-w-md px-3 py-2">{e.summary}</td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {e.entityType.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-3 py-2">
                      {/* Field-level detail, already redacted at write time —
                          REDACTED_FIELDS never reach this table. */}
                      <AuditChanges summary={e.summary} changes={e.changes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs tabular-nums">
              Page {result.page} of {result.pageCount} · {result.total} entr
              {result.total === 1 ? "y" : "ies"}
            </p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline" disabled={result.page <= 1}>
                <Link href={queryFor(result.page - 1)}>Previous</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                disabled={result.page >= result.pageCount}
              >
                <Link href={queryFor(result.page + 1)}>Next</Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "warning" && value > 0 && "text-status-warning",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
