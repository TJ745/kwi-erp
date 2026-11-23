"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { MAINTENANCE_TYPES } from "@/lib/schemas/fleet";
import { MAINTENANCE_SERVICES } from "@/lib/vehicle-maintenance";
import { addMaintenanceAction } from "@/server/actions/fleet";

const titleCase = (v: string) =>
  v
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

export function MaintenanceDialog({
  vehicleId,
  currentMileage,
  drivers,
  currentDriverId,
}: {
  vehicleId: string;
  currentMileage: number | null;
  /** The company's employees who can be named as the driver. */
  drivers: { id: string; fullName: string; employeeNo: string; companyCode: string }[];
  currentDriverId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addMaintenanceAction({
        vehicleId,
        date: readString(fd, "date"),
        type: readString(fd, "type") || "ROUTINE_SERVICE",
        description: readString(fd, "description"),
        mileage: readString(fd, "mileage"),
        workshop: readString(fd, "workshop"),
        cost: readString(fd, "cost"),
        nextDueDate: readString(fd, "nextDueDate"),
        nextDueMileage: readString(fd, "nextDueMileage"),
        notes: readString(fd, "notes"),
        requestNo: readString(fd, "requestNo"),
        driverId: readString(fd, "driverId"),
        services: fd.getAll("services").map(String),
        otherService: readString(fd, "otherService"),
        additionalDetails: readString(fd, "additionalDetails"),
        driverNotes: readString(fd, "driverNotes"),
        requiredParts: readString(fd, "requiredParts"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success("Maintenance recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus />
        Record maintenance
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record maintenance</DialogTitle>
            <DialogDescription>
              Prints as the Vehicle Maintenance Request. The vehicle, driver and previous mileage
              fill in on their own; the mileage you enter is the current reading.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
              >
                {formError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                name="date"
                label="Date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                errors={errors.date}
              />
              <SelectField
                name="type"
                label="Type"
                defaultValue="ROUTINE_SERVICE"
                options={MAINTENANCE_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
                errors={errors.type}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="requestNo"
                label="Req. #"
                hint="Blank numbers it automatically, e.g. KWI/VM/040."
                errors={errors.requestNo}
              />
              <SelectField
                name="driverId"
                label="Driver"
                placeholder="No driver"
                defaultValue={currentDriverId ?? ""}
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.fullName} (${d.employeeNo} · ${d.companyCode})`,
                }))}
                errors={errors.driverId}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Required service</legend>
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {MAINTENANCE_SERVICES.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="services" value={s.key} />
                    {s.en}
                  </label>
                ))}
              </div>
              <TextField
                name="otherService"
                label="Other (if ticked)"
                errors={errors.otherService}
              />
            </fieldset>

            <TextAreaField
              name="description"
              label="Work done / description"
              hint="Blank uses the ticked services."
              errors={errors.description}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="mileage"
                label="Current mileage (km)"
                hint={currentMileage ? `Previous reading ${String(currentMileage)} km` : undefined}
                errors={errors.mileage}
              />
              <TextField name="workshop" label="Workshop" errors={errors.workshop} />
              <TextField name="cost" label="Cost" hint="Numbers only." errors={errors.cost} />
              <div />
              <DateField name="nextDueDate" label="Next service due" errors={errors.nextDueDate} />
              <TextField
                name="nextDueMileage"
                label="Next due at mileage"
                errors={errors.nextDueMileage}
              />
            </div>

            <TextAreaField
              name="additionalDetails"
              label="Additional details"
              errors={errors.additionalDetails}
            />
            <TextAreaField name="driverNotes" label="Driver notes" errors={errors.driverNotes} />
            <TextAreaField
              name="requiredParts"
              label="Required parts"
              errors={errors.requiredParts}
            />
            <TextAreaField name="notes" label="Internal notes" errors={errors.notes} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
