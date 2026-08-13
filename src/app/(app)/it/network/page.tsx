import type { Metadata } from "next";
import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listIpAddresses, listNetworkDevices } from "@/server/services/infrastructure";
import { orgOptions } from "@/server/services/org";
import { NetworkControls } from "./network-controls";
import { IpControls } from "./ip-controls";

export const metadata: Metadata = { title: "Network & IP" };

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("it.infrastructure.manage");

  const [devices, addresses, options] = await Promise.all([
    listNetworkDevices(ctx, { ...(q ? { q } : {}) }),
    listIpAddresses(ctx, { ...(q ? { q } : {}) }),
    orgOptions(ctx),
  ]);

  const deviceOptions = devices.map((d) => ({ id: d.id, name: d.name }));

  return (
    <PageShell>
      <PageHeader
        title="Network & IP"
        description="Switches, routers, and firewalls, plus the IP register. Addresses are unique across the estate — a collision is a network fact, not an org-chart one."
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <IpControls devices={deviceOptions} mode="create" />
              <NetworkControls companies={options.companies} mode="create" />
            </div>
          ) : null
        }
      />

      <SearchInput placeholder="Search name, IP, or MAC…" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Devices</h2>
        {devices.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No network devices"
            description="Add a switch, router, or firewall."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">IP</th>
                  <th className="px-3 py-2 text-left font-medium">MAC</th>
                  <th className="px-3 py-2 text-left font-medium">VLAN</th>
                  <th className="px-3 py-2 text-right font-medium">Ports</th>
                  <th className="px-3 py-2 text-right font-medium">IPs</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  {canManage ? <th className="w-10 px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {d.company.code}
                        {d.location ? ` · ${d.location}` : ""}
                      </p>
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{d.type}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.ipAddress ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.macAddress ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">{d.vlan ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d.portCount ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d._count.ipAddresses}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={d.status === "ACTIVE" ? "default" : "outline"}>
                        {d.status}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <NetworkControls
                          companies={options.companies}
                          mode="row"
                          values={{
                            id: d.id,
                            companyId: d.companyId,
                            name: d.name,
                            type: d.type,
                            model: d.model,
                            ipAddress: d.ipAddress,
                            macAddress: d.macAddress,
                            location: d.location,
                            vlan: d.vlan,
                            portCount: d.portCount === null ? "" : String(d.portCount),
                            status: d.status,
                            notes: d.notes,
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
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">IP register</h2>
        {addresses.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No addresses recorded.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Address</th>
                  <th className="px-3 py-2 text-left font-medium">Subnet</th>
                  <th className="px-3 py-2 text-left font-medium">Assigned to</th>
                  <th className="px-3 py-2 text-left font-medium">Device</th>
                  <th className="px-3 py-2 text-left font-medium">Allocation</th>
                  {canManage ? <th className="w-10 px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {addresses.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{a.address}</td>
                    <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                      {a.subnet ?? "—"}
                    </td>
                    <td className="px-3 py-2">{a.assignedTo ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {a.device?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{a.isStatic ? "Static" : "DHCP"}</Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <IpControls
                          devices={deviceOptions}
                          mode="row"
                          values={{
                            id: a.id,
                            address: a.address,
                            subnet: a.subnet,
                            assignedTo: a.assignedTo,
                            deviceId: a.deviceId,
                            isStatic: a.isStatic,
                            notes: a.notes,
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
      </section>
    </PageShell>
  );
}
