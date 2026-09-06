import type { Metadata } from "next";
import { Mails } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  correspondenceCounts,
  employeeOptions,
  listCorrespondence,
} from "@/server/services/hr-records";
import { orgOptions } from "@/server/services/org";
import { CorrespondenceDialog } from "./correspondence-dialog";
import { CorrespondenceRowActions } from "./correspondence-row-actions";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Correspondence" };

export default async function CorrespondencePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.correspondence.view");
  const { status, type, q } = await searchParams;
  const canManage = ctx.permissions.has("hr.correspondence.manage");

  const [items, counts, employees, options] = await Promise.all([
    listCorrespondence(ctx, {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(q ? { q } : {}),
    }),
    correspondenceCounts(ctx),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
    orgOptions(ctx),
  ]);

  const today = new Date();

  return (
    <PageShell>
      <PageHeader
        title="Correspondence"
        description="Letters in and out — government, insurance, banks, suppliers. Follow-up dates are what stop a waiting reply being forgotten."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="correspondence-register" ctx={ctx} />
            {canManage ? (
              <CorrespondenceDialog companies={options.companies} employees={employees} />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Drafts" value={counts.drafts} />
        <StatCard label="Awaiting reply" value={counts.waiting} />
        <StatCard label="Follow-up due" value={counts.followUpDue} tone="warning" />
      </div>

      <SearchInput placeholder="Search subject or recipient…" />

      {items.length === 0 ? (
        <EmptyState
          icon={Mails}
          title={q ? "No matching correspondence" : "No correspondence logged"}
          description={
            q ? "Try a different search term." : "Log a letter to track its follow-up."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Subject</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Recipient</th>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Sent</th>
                <th className="px-3 py-2 text-left font-medium">Follow up</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                // Derived, not stored: an unfinished item past its follow-up
                // date is overdue whether or not anyone relabelled it.
                const overdue =
                  c.status !== "COMPLETED" && c.followUpDate !== null && c.followUpDate < today;

                return (
                  <tr key={c.id} className="border-t">
                    <td className="max-w-xs px-3 py-2">
                      <p className="truncate font-medium">{c.subject}</p>
                      <p className="text-muted-foreground text-xs">{c.company.code}</p>
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {c.type.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-3 py-2">{c.recipient}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {c.employee?.fullName ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 tabular-nums">
                      {c.sentDate ? c.sentDate.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {c.followUpDate ? (
                        <span className={cn(overdue && "text-status-expired font-medium")}>
                          {c.followUpDate.toISOString().slice(0, 10)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          c.status === "COMPLETED"
                            ? "default"
                            : overdue
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <CorrespondenceRowActions
                          item={{
                            id: c.id,
                            companyId: c.companyId,
                            employeeId: c.employeeId,
                            type: c.type,
                            subject: c.subject,
                            recipient: c.recipient,
                            sentDate: c.sentDate
                              ? c.sentDate.toISOString().slice(0, 10)
                              : null,
                            status: c.status,
                            followUpDate: c.followUpDate
                              ? c.followUpDate.toISOString().slice(0, 10)
                              : null,
                            notes: c.notes,
                          }}
                          companies={options.companies}
                          employees={employees}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
