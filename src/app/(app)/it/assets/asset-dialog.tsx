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
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { ASSET_CONDITIONS, ASSET_TYPES } from "@/lib/schemas/it";
import { createAssetAction, updateAssetAction } from "@/server/actions/it";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export type AssetFormValues = {
  id: string;
  companyId: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  assetTag: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  warrantyExpiry: string | null;
  condition: string;
  location: string | null;
  notes: string | null;
};

export function AssetDialog({
  companies,
  asset,
}: {
  companies: { id: string; code: string; name: string }[];
  asset?: AssetFormValues;
}) {
  const router = useRouter();
  const mode = asset ? "edit" : "create";
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
      type: readString(fd, "type"),
      brand: readString(fd, "brand"),
      model: readString(fd, "model"),
      serialNumber: readString(fd, "serialNumber"),
      assetTag: readString(fd, "assetTag"),
      purchaseDate: readString(fd, "purchaseDate"),
      purchaseCost: readString(fd, "purchaseCost"),
      warrantyExpiry: readString(fd, "warrantyExpiry"),
      condition: readString(fd, "condition") || "GOOD",
      location: readString(fd, "location"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = asset
        ? await updateAssetAction({ ...payload, id: asset.id })
        : await createAssetAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? "Asset registered." : "Asset updated.");
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
        {mode === "create" ? "Register asset" : "Edit"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Register asset" : "Edit asset"}
            </DialogTitle>
            <DialogDescription>
              An asset code is generated automatically. Serial numbers must be unique, and a
              warranty date feeds the expiry alerts.
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
              <SelectField
                name="companyId"
                label="Company"
                required
                defaultValue={asset?.companyId ?? companies[0]?.id ?? ""}
                options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                errors={errors.companyId}
              />
              <SelectField
                name="type"
                label="Type"
                required
                defaultValue={asset?.type ?? "LAPTOP"}
                options={ASSET_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
                errors={errors.type}
              />
              <TextField
                name="brand"
                label="Brand"
                required
                defaultValue={asset?.brand ?? ""}
                errors={errors.brand}
              />
              <TextField
                name="model"
                label="Model"
                required
                defaultValue={asset?.model ?? ""}
                errors={errors.model}
              />
              <TextField
                name="serialNumber"
                label="Serial number"
                defaultValue={asset?.serialNumber ?? ""}
                errors={errors.serialNumber}
              />
              <TextField
                name="assetTag"
                label="Asset tag"
                defaultValue={asset?.assetTag ?? ""}
                errors={errors.assetTag}
              />
              <DateField
                name="purchaseDate"
                label="Purchase date"
                defaultValue={asset?.purchaseDate ?? ""}
                errors={errors.purchaseDate}
              />
              <TextField
                name="purchaseCost"
                label="Purchase cost"
                hint="Numbers only."
                defaultValue={asset?.purchaseCost ?? ""}
                errors={errors.purchaseCost}
              />
              <DateField
                name="warrantyExpiry"
                label="Warranty expiry"
                defaultValue={asset?.warrantyExpiry ?? ""}
                errors={errors.warrantyExpiry}
              />
              <SelectField
                name="condition"
                label="Condition"
                defaultValue={asset?.condition ?? "GOOD"}
                options={ASSET_CONDITIONS.map((c) => ({ value: c, label: titleCase(c) }))}
                errors={errors.condition}
              />
              <TextField
                name="location"
                label="Location"
                defaultValue={asset?.location ?? ""}
                errors={errors.location}
              />
            </div>

            <TextAreaField
              name="notes"
              label="Notes"
              defaultValue={asset?.notes ?? ""}
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
