import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { driverOptions, getVehicle } from "@/server/services/fleet";
import { orgOptions } from "@/server/services/org";
import { VehicleDialog } from "../vehicle-dialog";
import { DriverPanel } from "./driver-panel";
import { MaintenanceDialog } from "./maintenance-dialog";

export const metadata: Metadata = { title: "Vehicle" };

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const ctx = await requirePagePermission("vehicles.view");
  const { vehicleId } = await params;
  const vehicle = await getVehicle(ctx, vehicleId);

  const canManage = ctx.permissions.has("vehicles.manage");
  const canAssign = ctx.permissions.has("vehicles.assign");
  const canMaintain = ctx.permissions.has("vehicles.maintenance.manage");

  const [drivers, options] = await Promise.all([
    canAssign ? driverOptions(ctx, vehicle.companyId) : Promise.resolve([]),
    canManage ? orgOptions(ctx) : Promise.resolve(null),
  ]);

  return (
    <PageShell>
      <Link
        href="/vehicles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to vehicles
      </Link>

      <PageHeader
        title={vehicle.plateNumber}
        description={`${vehicle.vehicleCode} · ${vehicle.make} ${vehicle.model} ${String(vehicle.year)} · ${vehicle.company.code}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={vehicle.status} />
            {canManage && options ? (
              <VehicleDialog
                companies={options.companies}
                vehicle={{
                  id: vehicle.id,
                  companyId: vehicle.companyId,
                  plateNumber: vehicle.plateNumber,
                  plateNumberAr: vehicle.plateNumberAr,
                  make: vehicle.make,
                  model: vehicle.model,
                  year: vehicle.year,
                  color: vehicle.color,
                  vin: vehicle.vin,
                  status: vehicle.status,
                  currentMileage: vehicle.currentMileage,
                  registrationNo: vehicle.registrationNo,
                  registrationExpiry: vehicle.registrationExpiry
                    ? vehicle.registrationExpiry.toISOString().slice(0, 10)
                    : null,
                  insurancePolicyNo: vehicle.insurancePolicyNo,
                  insuranceProvider: vehicle.insuranceProvider,
                  insuranceExpiry: vehicle.insuranceExpiry
                    ? vehicle.insuranceExpiry.toISOString().slice(0, 10)
                    : null,
                  notes: vehicle.notes,
                }}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Detail label="Number" value={vehicle.registrationNo} />
            <div>
              <p className="text-muted-foreground text-xs">Expires</p>
              {vehicle.registrationExpiry ? (
                <ExpiryAlert date={vehicle.registrationExpiry} />
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Insurance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Detail label="Provider" value={vehicle.insuranceProvider} />
            <Detail label="Policy" value={vehicle.insurancePolicyNo} />
            <div>
              <p className="text-muted-foreground text-xs">Expires</p>
              {vehicle.insuranceExpiry ? (
                <ExpiryAlert date={vehicle.insuranceExpiry} />
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
          </CardContent>
        </Card>

        <DriverPanel
          vehicleId={vehicle.id}
          plateNumber={vehicle.plateNumber}
          canAssign={canAssign}
          drivers={drivers}
          current={
            vehicle.currentDriver
              ? {
                  id: vehicle.currentDriver.id,
                  name: vehicle.currentDriver.fullName,
                  employeeNo: vehicle.currentDriver.employeeNo,
                }
              : null
          }
        />
      </div>

      <Tabs defaultValue="maintenance">
        <TabsList>
          <TabsTrigger value="maintenance">
            Maintenance{vehicle.maintenance.length > 0 ? ` (${String(vehicle.maintenance.length)})` : ""}
          </TabsTrigger>
          <TabsTrigger value="handovers">
            Handovers{vehicle.handovers.length > 0 ? ` (${String(vehicle.handovers.length)})` : ""}
          </TabsTrigger>
          <TabsTrigger value="drivers">Driver history</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="mt-4 space-y-4">
          {canMaintain ? (
            <div className="flex justify-end">
              <MaintenanceDialog
                vehicleId={vehicle.id}
                currentMileage={vehicle.currentMileage}
              />
            </div>
          ) : null}

          {vehicle.maintenance.length === 0 ? (
            <EmptyState
              title="No maintenance recorded"
              description="Log services, repairs, and inspections to build a history for this vehicle."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">Maintenance history</caption>
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Mileage</th>
                    <th className="px-4 py-2 font-medium">Workshop</th>
                    <th className="px-4 py-2 font-medium">Next due</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicle.maintenance.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-4 py-2 tabular-nums">
                        {m.date.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-2">
                        {m.type.replace(/_/g, " ").toLowerCase()}
                      </td>
                      <td className="px-4 py-2">{m.description}</td>
                      <td className="px-4 py-2 tabular-nums">{m.mileage ?? "—"}</td>
                      <td className="text-muted-foreground px-4 py-2">{m.workshop ?? "—"}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {m.nextDueDate ? m.nextDueDate.toISOString().slice(0, 10) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="handovers" className="mt-4">
          {vehicle.handovers.length === 0 ? (
            <EmptyState
              title="No handovers recorded"
              description="A handover records mileage, fuel level, condition, and who took the keys."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {vehicle.handovers.map((h) => (
                <li key={h.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {h.fromEmployee?.fullName ?? "Pool"} → {h.toEmployee?.fullName ?? "Pool"}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {h.handoverDate.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {h.mileage !== null ? `${String(h.mileage)} km · ` : ""}
                    fuel {h.fuelLevel.replace(/_/g, " ").toLowerCase()} · condition{" "}
                    {h.condition.toLowerCase()}
                  </p>
                  {h.remarks ? <p className="mt-1 text-sm">{h.remarks}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          {vehicle.assignments.length === 0 ? (
            <EmptyState title="No driver history" />
          ) : (
            <ul className="divide-y rounded-lg border">
              {vehicle.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-4">
                  <Link
                    href={`/people/employees/${a.employee.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {a.employee.fullName}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {a.employee.employeeNo}
                    </span>
                  </Link>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {a.assignedAt.toISOString().slice(0, 10)} →{" "}
                    {a.unassignedAt ? a.unassignedAt.toISOString().slice(0, 10) : "current"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="px-6 py-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="VIN / chassis" value={vehicle.vin} />
                <Detail label="Colour" value={vehicle.color} />
                <Detail
                  label="Current mileage"
                  value={vehicle.currentMileage ? String(vehicle.currentMileage) : null}
                />
                <Detail label="Arabic plate" value={vehicle.plateNumberAr} />
              </dl>
              {vehicle.notes ? (
                <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
                  {vehicle.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
