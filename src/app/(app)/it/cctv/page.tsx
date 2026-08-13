import type { Metadata } from "next";
import { Cctv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listCctv } from "@/server/services/infrastructure";
import { orgOptions } from "@/server/services/org";
import { CctvControls } from "./cctv-controls";

export const metadata: Metadata = { title: "CCTV" };

export default async function CctvPage() {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const canManage = ctx.permissions.has("it.infrastructure.manage");

  const [devices, options] = await Promise.all([listCctv(ctx), orgOptions(ctx)]);
  const recorders = devices
    .filter((d) => d.type === "NVR" || d.type === "DVR")
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <PageShell>
      <PageHeader
        title="CCTV"
        description="Cameras and the recorders they feed. Only an NVR or DVR can be a recorder, and one with cameras attached cannot be demoted or deleted."
        action={
          canManage ? (
            <CctvControls
              companies={options.companies}
              recorders={recorders}
              mode="create"
            />
          ) : null
        }
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={Cctv}
          title="No CCTV devices"
          description="Add a recorder first, then the cameras that feed it."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
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
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground text-xs">{d.company.code}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={isRecorder ? "default" : "outline"}>{d.type}</Badge>
                      {isRecorder && d._count.cameras > 0 ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {d._count.cameras} camera(s)
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{d.location}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.ipAddress ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {d.recorder?.name ?? (isRecorder ? "—" : "Not attached")}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 tabular-nums">
                      {d.lastMaintenanceAt
                        ? d.lastMaintenanceAt.toISOString().slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={d.status === "ACTIVE" ? "default" : "outline"}>
                        {d.status}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <CctvControls
                          companies={options.companies}
                          // A device cannot record to itself, so it is not
                          // offered as its own recorder.
                          recorders={recorders.filter((r) => r.id !== d.id)}
                          mode="row"
                          values={{
                            id: d.id,
                            companyId: d.companyId,
                            name: d.name,
                            type: d.type,
                            location: d.location,
                            ipAddress: d.ipAddress,
                            recorderId: d.recorderId,
                            status: d.status,
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
