"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import {
  DateField,
  FieldSet,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { VEHICLE_STATUSES } from "@/lib/schemas/fleet";
import { createVehicleAction, updateVehicleAction } from "@/server/actions/fleet";

const titleCase = (v: string) =>
  v
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

export type VehicleFormValues = {
  id: string;
  companyId: string;
  plateNumber: string;
  plateNumberAr: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
  vin: string | null;
  status: string;
  currentMileage: number | null;
  registrationNo: string | null;
  registrationExpiry: string | null;
  insurancePolicyNo: string | null;
  insuranceProvider: string | null;
  insuranceExpiry: string | null;
  notes: string | null;
};

export function VehicleDialog({
  companies,
  vehicle,
}: {
  companies: { id: string; code: string; name: string }[];
  vehicle?: VehicleFormValues;
}) {
  const router = useRouter();
  const mode = vehicle ? "edit" : "create";
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const payload = {
      companyId: readString(fd, "companyId"),
      plateNumber: readString(fd, "plateNumber"),
      plateNumberAr: readString(fd, "plateNumberAr"),
      make: readString(fd, "make"),
      model: readString(fd, "model"),
      year: readString(fd, "year"),
      color: readString(fd, "color"),
      vin: readString(fd, "vin"),
      status: readString(fd, "status") || "ACTIVE",
      currentMileage: readString(fd, "currentMileage"),
      registrationNo: readString(fd, "registrationNo"),
      registrationExpiry: readString(fd, "registrationExpiry"),
      insurancePolicyNo: readString(fd, "insurancePolicyNo"),
      insuranceProvider: readString(fd, "insuranceProvider"),
      insuranceExpiry: readString(fd, "insuranceExpiry"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = vehicle
        ? await updateVehicleAction({ ...payload, id: vehicle.id })
        : await createVehicleAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? "Vehicle registered." : "Vehicle updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={mode === "create" ? "default" : "outline"}
        onClick={() => {
          setOpen(true);
        }}
      >
        {mode === "create" ? <Plus /> : <Pencil />}
        {mode === "create" ? "Add vehicle" : "Edit"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add vehicle" : "Edit vehicle"}</DialogTitle>
            <DialogDescription>
              Registration and insurance expiry dates each raise their own alert, so both are worth
              filling in.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            {formError ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
              >
                {formError}
              </div>
            ) : null}

            <FieldSet legend="Vehicle">
              <SelectField
                name="companyId"
                label="Company"
                required
                defaultValue={vehicle?.companyId ?? companies[0]?.id ?? ""}
                options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                errors={errors.companyId}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={vehicle?.status ?? "ACTIVE"}
                options={VEHICLE_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
                errors={errors.status}
              />
              <TextField
                name="plateNumber"
                label="Plate number"
                required
                defaultValue={vehicle?.plateNumber ?? ""}
                errors={errors.plateNumber}
              />
              <TextField
                name="plateNumberAr"
                label="Plate number (Arabic)"
                defaultValue={vehicle?.plateNumberAr ?? ""}
                errors={errors.plateNumberAr}
              />
              <TextField
                name="make"
                label="Make"
                required
                defaultValue={vehicle?.make ?? ""}
                errors={errors.make}
              />
              <TextField
                name="model"
                label="Model"
                required
                defaultValue={vehicle?.model ?? ""}
                errors={errors.model}
              />
              <TextField
                name="year"
                label="Year"
                required
                defaultValue={vehicle ? String(vehicle.year) : ""}
                errors={errors.year}
              />
              <TextField
                name="color"
                label="Colour"
                defaultValue={vehicle?.color ?? ""}
                errors={errors.color}
              />
              <TextField
                name="vin"
                label="VIN / chassis"
                defaultValue={vehicle?.vin ?? ""}
                errors={errors.vin}
              />
              <TextField
                name="currentMileage"
                label="Current mileage"
                defaultValue={vehicle?.currentMileage ? String(vehicle.currentMileage) : ""}
                errors={errors.currentMileage}
              />
            </FieldSet>

            <FieldSet legend="Registration">
              <TextField
                name="registrationNo"
                label="Registration number"
                defaultValue={vehicle?.registrationNo ?? ""}
                errors={errors.registrationNo}
              />
              <DateField
                name="registrationExpiry"
                label="Registration expiry"
                defaultValue={vehicle?.registrationExpiry ?? ""}
                errors={errors.registrationExpiry}
              />
            </FieldSet>

            <FieldSet legend="Insurance">
              <TextField
                name="insuranceProvider"
                label="Provider"
                defaultValue={vehicle?.insuranceProvider ?? ""}
                errors={errors.insuranceProvider}
              />
              <TextField
                name="insurancePolicyNo"
                label="Policy number"
                defaultValue={vehicle?.insurancePolicyNo ?? ""}
                errors={errors.insurancePolicyNo}
              />
              <DateField
                name="insuranceExpiry"
                label="Insurance expiry"
                defaultValue={vehicle?.insuranceExpiry ?? ""}
                errors={errors.insuranceExpiry}
              />
            </FieldSet>

            <TextAreaField
              name="notes"
              label="Notes"
              defaultValue={vehicle?.notes ?? ""}
              errors={errors.notes}
            />

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
                {pending ? "Saving…" : mode === "create" ? "Register" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
