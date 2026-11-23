"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { FUEL_LEVELS } from "@/lib/schemas/fleet";
import {
  assignDriverAction,
  recordHandoverAction,
  unassignDriverAction,
} from "@/server/actions/fleet";

const titleCase = (v: string) =>
  v
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

/**
 * Driver assignment and handover.
 *
 * A handover is the richer path: it closes the old assignment and opens the new
 * one in the same transaction, so the driver record and the handover form can
 * never disagree.
 */
export function DriverPanel({
  vehicleId,
  plateNumber,
  vehicleLabel,
  canAssign,
  drivers,
  current,
}: {
  vehicleId: string;
  plateNumber: string;
  /** Default wording for the handover letter, e.g. "bus" or "vehicle". */
  vehicleLabel: string;
  canAssign: boolean;
  drivers: { id: string; fullName: string; employeeNo: string; companyCode: string }[];
  current: { id: string; name: string; employeeNo: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await assignDriverAction({
        vehicleId,
        employeeId: readString(fd, "employeeId"),
        notes: readString(fd, "notes"),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success("Driver assigned.");
      setAssignOpen(false);
      router.refresh();
    });
  }

  function unassign() {
    startTransition(async () => {
      const result = await unassignDriverAction({ vehicleId });
      if (result.success) {
        toast.success("Driver unassigned.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await recordHandoverAction({
        vehicleId,
        toEmployeeId: readString(fd, "toEmployeeId"),
        handoverDate: readString(fd, "handoverDate"),
        mileage: readString(fd, "mileage"),
        fuelLevel: readString(fd, "fuelLevel") || "FULL",
        condition: readString(fd, "condition") || "GOOD",
        accessories: readString(fd, "accessories"),
        damages: readString(fd, "damages"),
        vehicleLabel: readString(fd, "vehicleLabel"),
        remarks: readString(fd, "remarks"),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success("Handover recorded.");
      setHandoverOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Current driver</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {current ? (
          <div>
            <Link href={`/people/employees/${current.id}`} className="font-medium hover:underline">
              {current.name}
            </Link>
            <p className="text-muted-foreground font-mono text-xs">{current.employeeNo}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Unassigned — in the pool.</p>
        )}

        {canAssign ? (
          <div className="flex flex-wrap gap-2">
            {current ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setHandoverOpen(true);
                  }}
                >
                  <ArrowLeftRight />
                  Handover
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={unassign}>
                  <UserMinus />
                  Unassign
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={pending || drivers.length === 0}
                onClick={() => {
                  setAssignOpen(true);
                }}
              >
                <UserPlus />
                Assign driver
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>

      {/* Assign */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <form onSubmit={assign} noValidate>
            <DialogHeader>
              <DialogTitle>Assign a driver to {plateNumber}</DialogTitle>
              <DialogDescription>
                A vehicle can have only one active driver at a time.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}
              <SelectField
                name="employeeId"
                label="Driver"
                required
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.fullName} (${d.employeeNo} · ${d.companyCode})`,
                }))}
                errors={errors.employeeId}
              />
              <TextAreaField name="notes" label="Notes" errors={errors.notes} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAssignOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Assigning…" : "Assign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Handover */}
      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handover} noValidate>
            <DialogHeader>
              <DialogTitle>Vehicle handover — {plateNumber}</DialogTitle>
              <DialogDescription>
                Records mileage, fuel, condition, and accessories. Leave the new driver blank to
                return the vehicle to the pool.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              <SelectField
                name="toEmployeeId"
                label="Handing over to"
                defaultValue="none"
                options={[
                  { value: "none", label: "— Return to pool —" },
                  ...drivers
                    .filter((d) => d.id !== current?.id)
                    .map((d) => ({
                      value: d.id,
                      label: `${d.fullName} (${d.employeeNo} · ${d.companyCode})`,
                    })),
                ]}
                errors={errors.toEmployeeId}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  name="handoverDate"
                  label="Handover date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  errors={errors.handoverDate}
                />
                <TextField name="mileage" label="Mileage" errors={errors.mileage} />
                <SelectField
                  name="fuelLevel"
                  label="Fuel level"
                  defaultValue="FULL"
                  options={FUEL_LEVELS.map((f) => ({ value: f, label: titleCase(f) }))}
                  errors={errors.fuelLevel}
                />
                <SelectField
                  name="condition"
                  label="Condition"
                  defaultValue="GOOD"
                  options={["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"].map((c) => ({
                    value: c,
                    label: titleCase(c),
                  }))}
                  errors={errors.condition}
                />
              </div>

              <TextField
                name="accessories"
                label="Accessories"
                hint="e.g. spare tyre, jack, first-aid kit"
                errors={errors.accessories}
              />
              <TextField
                name="vehicleLabel"
                label="The letter calls it “the company …”"
                defaultValue={vehicleLabel}
                hint="e.g. bus, car, pickup."
                errors={errors.vehicleLabel}
              />
              <TextAreaField
                name="damages"
                label="Damage noted / notes for the letter"
                hint="One per line, e.g. “Left door back mirror is broken.” Each prints as a numbered note."
                rows={4}
                errors={errors.damages}
              />
              <TextAreaField name="remarks" label="Remarks" errors={errors.remarks} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setHandoverOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Recording…" : "Record handover"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
