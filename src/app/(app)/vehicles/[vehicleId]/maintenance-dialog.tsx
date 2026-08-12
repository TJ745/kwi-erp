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
import { addMaintenanceAction } from "@/server/actions/fleet";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function MaintenanceDialog({
  vehicleId,
  currentMileage,
}: {
  vehicleId: string;
  currentMileage: number | null;
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
      <Button size="sm" onClick={() => { setOpen(true); }}>
        <Plus />
        Record maintenance
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record maintenance</DialogTitle>
            <DialogDescription>
              Recording mileage also updates the vehicle&apos;s current reading. It cannot go
              backwards.
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

            <TextAreaField
              name="description"
              label="Description"
              required
              errors={errors.description}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="mileage"
                label="Mileage"
                hint={currentMileage ? `Currently ${String(currentMileage)} km` : undefined}
                errors={errors.mileage}
              />
              <TextField name="workshop" label="Workshop" errors={errors.workshop} />
              <TextField
                name="cost"
                label="Cost"
                hint="Numbers only."
                errors={errors.cost}
              />
              <div />
              <DateField
                name="nextDueDate"
                label="Next service due"
                errors={errors.nextDueDate}
              />
              <TextField
                name="nextDueMileage"
                label="Next due at mileage"
                errors={errors.nextDueMileage}
              />
            </div>

            <TextAreaField name="notes" label="Notes" errors={errors.notes} />

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
