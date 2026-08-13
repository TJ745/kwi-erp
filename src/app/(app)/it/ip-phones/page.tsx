import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listIpPhones } from "@/server/services/infrastructure";
import { employeeOptions } from "@/server/services/hr-records";
import { PhoneControls } from "./phone-controls";

export const metadata: Metadata = { title: "IP Phones" };

export default async function IpPhonesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("it.infrastructure.manage");

  const [phones, employees] = await Promise.all([
    listIpPhones(ctx, { ...(q ? { q } : {}) }),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="IP Phones"
        description="Handsets and extensions. An extension is unique — the directory depends on it."
        action={canManage ? <PhoneControls employees={employees} mode="create" /> : null}
      />

      <SearchInput placeholder="Search extension or MAC…" />

      {phones.length === 0 ? (
        <EmptyState
          icon={Phone}
          title={q ? "No matching handsets" : "No handsets"}
          description={q ? "Try a different search term." : "Add a handset to record it."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Extension</th>
                <th className="px-3 py-2 text-left font-medium">Assigned to</th>
                <th className="px-3 py-2 text-left font-medium">Model</th>
                <th className="px-3 py-2 text-left font-medium">MAC</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {phones.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono font-medium">{p.extension}</td>
                  <td className="px-3 py-2">
                    {p.employee ? (
                      <>
                        <p>{p.employee.fullName}</p>
                        <p className="text-muted-foreground text-xs">
                          {p.employee.employeeNo} · {p.employee.company.code}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Pool stock</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{p.deviceModel ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.macAddress ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{p.location ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={p.status === "ACTIVE" ? "default" : "outline"}>
                      {p.status}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <PhoneControls
                        employees={employees}
                        mode="row"
                        values={{
                          id: p.id,
                          extension: p.extension,
                          employeeId: p.employeeId,
                          deviceModel: p.deviceModel,
                          macAddress: p.macAddress,
                          location: p.location,
                          status: p.status,
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
