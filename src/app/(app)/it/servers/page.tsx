import type { Metadata } from "next";
import { Server as ServerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listServers } from "@/server/services/infrastructure";
import { orgOptions } from "@/server/services/org";
import { ServerControls } from "./server-controls";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Servers" };

export default async function ServersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const { q, status } = await searchParams;
  const canManage = ctx.permissions.has("it.infrastructure.manage");

  const [servers, options] = await Promise.all([
    listServers(ctx, { ...(q ? { q } : {}), ...(status ? { status } : {}) }),
    orgOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Servers"
        description="Physical and virtual servers, their roles, and their specifications."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="server-register" ctx={ctx} />
            {canManage ? <ServerControls companies={options.companies} mode="create" /> : null}
          </div>
        }
      />

      <SearchInput placeholder="Search name, IP, or role…" />

      {servers.length === 0 ? (
        <EmptyState
          icon={ServerIcon}
          title={q ? "No matching servers" : "No servers"}
          description={q ? "Try a different search term." : "Add a server to record it."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">IP</th>
                <th className="px-3 py-2 text-left font-medium">Role</th>
                <th className="px-3 py-2 text-left font-medium">OS</th>
                <th className="px-3 py-2 text-left font-medium">Specification</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.ipAddress ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{s.role ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{s.os ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {[
                      s.cpuSpec,
                      s.ramGb ? `${String(s.ramGb)} GB RAM` : null,
                      s.storageGb ? `${String(s.storageGb)} GB` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{s.location ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{s.company.code}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.status === "ACTIVE" ? "default" : "outline"}>
                      {s.status}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <ServerControls
                        companies={options.companies}
                        mode="row"
                        values={{
                          id: s.id,
                          companyId: s.companyId,
                          name: s.name,
                          ipAddress: s.ipAddress,
                          os: s.os,
                          role: s.role,
                          location: s.location,
                          cpuSpec: s.cpuSpec,
                          ramGb: s.ramGb === null ? "" : String(s.ramGb),
                          storageGb: s.storageGb === null ? "" : String(s.storageGb),
                          status: s.status,
                          notes: s.notes,
                        }}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
