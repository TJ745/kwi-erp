import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listHandovers } from "@/server/services/fleet";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Vehicle Handovers" };

export default async function HandoversPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requirePagePermission("vehicles.view");
  const { from, to } = await searchParams;
  const canDownload = ctx.permissions.has("documents.download");

  const handovers = await listHandovers(ctx, {
    ...(from ? { from: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999Z`) } : {}),
  });

  return (
    <PageShell>
      <PageHeader
        printable
        title="Vehicle Handovers"
        description="Every change of keys across the fleet. A handover is what moves a vehicle's driver — the assignment closes and reopens with it."
        action={<ReportLink reportId="vehicle-handover" ctx={ctx} />}
      />

      {handovers.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No handovers recorded"
          description="Handovers are recorded from a vehicle's own page."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Vehicle</th>
                <th className="px-3 py-2 text-left font-medium">From</th>
                <th className="px-3 py-2 text-left font-medium">To</th>
                <th className="px-3 py-2 text-right font-medium">Mileage</th>
                <th className="px-3 py-2 text-left font-medium">Fuel</th>
                <th className="px-3 py-2 text-left font-medium">Condition</th>
                <th className="px-3 py-2 text-left font-medium">Acknowledged</th>
                <th className="w-10 px-3 py-2" />
                {canDownload ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {handovers.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums">
                    {h.handoverDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/vehicles/${h.vehicle.id}`}
                      className="font-medium hover:underline"
                    >
                      {h.vehicle.plateNumber}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {h.vehicle.make} {h.vehicle.model} · {h.vehicle.company.code}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {h.fromEmployee ? (
                      <Link
                        href={`/people/employees/${h.fromEmployee.id}`}
                        className="hover:underline"
                      >
                        {h.fromEmployee.fullName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Pool</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {h.toEmployee ? (
                      <Link
                        href={`/people/employees/${h.toEmployee.id}`}
                        className="hover:underline"
                      >
                        {h.toEmployee.fullName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Returned to pool</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {h.mileage === null ? "—" : h.mileage.toLocaleString("en-US")}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {h.fuelLevel.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{h.condition.toLowerCase()}</td>
                  <td className="px-3 py-2">
                    {h.acknowledgedAt ? (
                      <span className="text-muted-foreground tabular-nums">
                        {h.acknowledgedAt.toISOString().slice(0, 10)}
                      </span>
                    ) : (
                      <Badge variant="outline">Not signed</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button asChild size="sm" variant="outline" data-print-hide>
                      <Link href={`/vehicles/handovers/${h.id}`}>
                        <Printer />
                        Print
                      </Link>
                    </Button>
                  </td>
                  {canDownload ? (
                    <td className="px-3 py-2">
                      {h.documentId ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/api/files/${h.documentId}`}>Form</a>
                        </Button>
                      ) : null}
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
