import type { Metadata } from "next";
import { ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listAdRecords, orphanedAdAccounts } from "@/server/services/infrastructure";
import { employeeOptions } from "@/server/services/hr-records";
import { AdControls } from "./ad-controls";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Active Directory" };

function groupList(groups: unknown): string[] {
  return Array.isArray(groups) ? groups.filter((g): g is string => typeof g === "string") : [];
}

export default async function ActiveDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("it.infrastructure.manage");

  const [records, orphaned, employees] = await Promise.all([
    listAdRecords(ctx, { ...(q ? { q } : {}) }),
    orphanedAdAccounts(ctx),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Active Directory"
        description="Directory metadata only — account name, OU, groups, enabled. No credentials are stored here; passwords belong in the vault."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="ad-account-register" ctx={ctx} />
            {canManage ? <AdControls employees={employees} mode="create" /> : null}
          </div>
        }
      />

      {orphaned.length > 0 ? (
        <div
          role="alert"
          className="border-status-expired/40 bg-status-expired/5 rounded-md border p-3"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="size-4" aria-hidden="true" />
            {orphaned.length} enabled account
            {orphaned.length === 1 ? "" : "s"} belonging to someone who has left
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {orphaned.map((o) => (
              <li key={o.id}>
                <span className="font-mono">{o.samAccountName}</span> —{" "}
                {o.employee?.fullName} ({o.employee?.status.toLowerCase()})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SearchInput placeholder="Search account name…" />

      {records.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No matching accounts" : "No AD records"}
          description={
            q ? "Try a different search term." : "Record an account to track it here."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">OU</th>
                <th className="px-3 py-2 text-left font-medium">Groups</th>
                <th className="px-3 py-2 text-left font-medium">State</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const groups = groupList(r.groups);
                const departed =
                  r.employee !== null &&
                  ["RESIGNED", "TERMINATED", "EXITED", "INACTIVE"].includes(
                    r.employee.status,
                  );

                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-mono font-medium">{r.samAccountName}</td>
                    <td className="px-3 py-2">
                      {r.employee ? (
                        <>
                          <p>{r.employee.fullName}</p>
                          <p className="text-muted-foreground text-xs">
                            {r.employee.employeeNo} · {r.employee.company.code} ·{" "}
                            {r.employee.status.toLowerCase()}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unlinked</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.ou ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {groups.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {groups.slice(0, 3).map((g) => (
                            <Badge key={g} variant="outline" className="text-xs">
                              {g}
                            </Badge>
                          ))}
                          {groups.length > 3 ? (
                            <span className="text-muted-foreground text-xs">
                              +{groups.length - 3}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          r.enabled && departed
                            ? "destructive"
                            : r.enabled
                              ? "default"
                              : "outline"
                        }
                      >
                        {r.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <AdControls
                          employees={employees}
                          mode="row"
                          values={{
                            id: r.id,
                            samAccountName: r.samAccountName,
                            employeeId: r.employeeId,
                            ou: r.ou,
                            groups: groups.join(", "),
                            enabled: r.enabled,
                            notes: r.notes,
                          }}
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
