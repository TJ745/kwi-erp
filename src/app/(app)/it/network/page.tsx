import type { Metadata } from "next";
import Link from "next/link";
import { Network } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { assetTypeLabel } from "@/lib/schemas/it";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listDeviceIps } from "@/server/services/infrastructure";

export const metadata: Metadata = { title: "Device IPs" };

export default async function DeviceIpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const { q } = await searchParams;
  const canViewAssets = ctx.permissions.has("it.assets.view");

  const devices = await listDeviceIps(ctx, { ...(q ? { q } : {}) });

  return (
    <PageShell>
      <PageHeader
        printable
        title="Device IPs"
        description="Every asset with an IP address. To add or change an IP, edit the device in Assets — it is kept in one place."
        action={
          canViewAssets ? (
            <Link href="/it/assets" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Go to Assets
            </Link>
          ) : null
        }
      />

      <SearchInput placeholder="Search IP, device, asset code, MAC, or location…" />

      {devices.length === 0 ? (
        <EmptyState
          icon={Network}
          title={q ? "No matching devices" : "No device IPs yet"}
          description={
            q
              ? "Try a different search."
              : "Register the device in Assets and fill in its IP address — it appears here automatically."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">IP address</th>
                <th className="px-3 py-2 text-left font-medium">Device</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">MAC</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Assigned to</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-mono font-medium">{d.ipAddress}</td>
                  <td className="px-3 py-2">
                    {canViewAssets ? (
                      <Link href={`/it/assets/${d.id}`} className="hover:underline">
                        {d.device}
                      </Link>
                    ) : (
                      d.device
                    )}
                    <p className="text-muted-foreground font-mono text-xs">
                      {d.assetCode} · {d.companyCode}
                    </p>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{assetTypeLabel(d.type)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.macAddress ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{d.location ?? "—"}</td>
                  <td className="px-3 py-2">
                    {d.holder ? (
                      d.holder.fullName
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {devices.length} {devices.length === 1 ? "device" : "devices"}
      </p>
    </PageShell>
  );
}
