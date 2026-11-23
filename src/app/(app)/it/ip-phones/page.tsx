import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReportLink } from "@/components/shared/report-link";
import { requirePagePermission } from "@/server/auth/page-guards";
import { ipPhoneHandsetOptions, listIpPhones } from "@/server/services/infrastructure";
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
  const canViewAssets = ctx.permissions.has("it.assets.view");

  const [phones, handsets] = await Promise.all([
    listIpPhones(ctx, { ...(q ? { q } : {}) }),
    canManage ? ipPhoneHandsetOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        printable
        title="IP Phones"
        description="Extensions and the handset each one rings on. Handset details — model, MAC, location, status, holder — come from Assets, so they are entered once."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="ip-phone-register" ctx={ctx} />
            {canManage ? <PhoneControls handsets={handsets} mode="create" /> : null}
          </div>
        }
      />

      <SearchInput placeholder="Search extension, asset code, model, MAC, or location…" />

      {phones.length === 0 ? (
        <EmptyState
          icon={Phone}
          title={q ? "No matching extensions" : "No extensions yet"}
          description={
            q
              ? "Try a different search term."
              : "Add the handset in Assets with type IP Phone, then add its extension here."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Extension</th>
                <th className="px-3 py-2 text-left font-medium">Handset</th>
                <th className="px-3 py-2 text-left font-medium">Assigned to</th>
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
                    {canViewAssets ? (
                      <Link href={`/it/assets/${p.handset.id}`} className="hover:underline">
                        {p.handset.label}
                      </Link>
                    ) : (
                      p.handset.label
                    )}
                    <p className="text-muted-foreground font-mono text-xs">
                      {p.handset.assetCode} · {p.handset.companyCode}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {p.holder ? (
                      <>
                        <p>{p.holder.fullName}</p>
                        <p className="text-muted-foreground text-xs">{p.holder.employeeNo}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not assigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.handset.macAddress ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{p.handset.location ?? "—"}</td>
                  <td className="px-3 py-2">
                    {p.handset.removed ? (
                      <span className="text-muted-foreground text-xs">Asset removed</span>
                    ) : (
                      <StatusBadge status={p.handset.status} />
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <PhoneControls
                        handsets={handsets}
                        mode="row"
                        values={{ id: p.id, extension: p.extension, assetId: p.assetId }}
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
