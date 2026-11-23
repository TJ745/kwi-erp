import type { Metadata } from "next";
import Link from "next/link";
import { Cctv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReportLink } from "@/components/shared/report-link";
import { requirePagePermission } from "@/server/auth/page-guards";
import { cctvAssetOptions, listCctv } from "@/server/services/infrastructure";
import { CctvControls } from "./cctv-controls";

export const metadata: Metadata = { title: "CCTV" };

export default async function CctvPage() {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const canManage = ctx.permissions.has("it.infrastructure.manage");
  const canViewAssets = ctx.permissions.has("it.assets.view");

  const [devices, assets] = await Promise.all([
    listCctv(ctx),
    canManage ? cctvAssetOptions(ctx) : Promise.resolve([]),
  ]);
  const recorders = devices
    .filter((d) => d.type === "NVR" || d.type === "DVR")
    .map((d) => ({
      id: d.id,
      label: `${d.device.assetCode} · ${d.device.label}${d.device.location ? ` · ${d.device.location}` : ""}`,
    }));

  return (
    <PageShell>
      <PageHeader
        printable
        title="CCTV"
        description="Cameras and the recorders they feed. The hardware itself — model, location, IP, status — lives in Assets; this page adds the camera type, recorder, and maintenance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="cctv-register" ctx={ctx} />
            {canManage ? (
              <CctvControls assets={assets} recorders={recorders} mode="create" />
            ) : null}
          </div>
        }
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={Cctv}
          title="No CCTV devices"
          description="Register the recorder and cameras in Assets (types CCTV Recorder and CCTV Camera), then add them here — recorder first."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Device</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">IP</th>
                <th className="px-3 py-2 text-left font-medium">Records to</th>
                <th className="px-3 py-2 text-left font-medium">Last maintained</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const isRecorder = d.type === "NVR" || d.type === "DVR";
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">
                      {canViewAssets ? (
                        <Link href={`/it/assets/${d.device.id}`} className="font-medium hover:underline">
                          {d.device.label}
                        </Link>
                      ) : (
                        <span className="font-medium">{d.device.label}</span>
                      )}
                      <p className="text-muted-foreground font-mono text-xs">
                        {d.device.assetCode} · {d.device.companyCode}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={isRecorder ? "default" : "outline"}>{d.type}</Badge>
                      {isRecorder && d.cameraCount > 0 ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {d.cameraCount} camera(s)
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{d.device.location ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.device.ipAddress ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {d.recorder?.label ?? (isRecorder ? "—" : "Not attached")}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 tabular-nums">
                      {d.lastMaintenanceAt ? d.lastMaintenanceAt.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {d.device.removed ? (
                        <span className="text-muted-foreground text-xs">Asset removed</span>
                      ) : (
                        <StatusBadge status={d.device.status} />
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <CctvControls
                          assets={assets}
                          recorders={recorders}
                          mode="row"
                          values={{
                            id: d.id,
                            assetId: d.assetId,
                            assetCode: d.device.assetCode,
                            type: d.type,
                            recorderId: d.recorderId,
                            lastMaintenanceAt: d.lastMaintenanceAt
                              ? d.lastMaintenanceAt.toISOString().slice(0, 10)
                              : "",
                            notes: d.notes,
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
