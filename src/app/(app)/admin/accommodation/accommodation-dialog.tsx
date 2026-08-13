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
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { ACCOMMODATION_TYPES, RECORD_STATUSES } from "@/lib/schemas/accommodation";
import {
  createAccommodationAction,
  updateAccommodationAction,
} from "@/server/actions/accommodation";

export type AccommodationValues = {
  id: string;
  companyId: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  type: string;
  status: string;
  notes: string | null;
};

export function AccommodationDialog({
  companies,
  accommodation,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  accommodation?: AccommodationValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      name: readString(fd, "name"),
      addressLine: readString(fd, "addressLine"),
      city: readString(fd, "city"),
      type: readString(fd, "type"),
      status: readString(fd, "status"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = accommodation
        ? await updateAccommodationAction({ ...values, id: accommodation.id })
        : await createAccommodationAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(accommodation ? "Property updated." : "Property added.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {!isControlled ? (
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          Add property
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {accommodation ? "Edit property" : "Add property"}
              </DialogTitle>
              <DialogDescription>
                Rooms and beds are added from the property&apos;s own page.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="name"
                  label="Property name"
                  required
                  defaultValue={accommodation?.name ?? ""}
                  errors={errors.name}
                />
                <SelectField
                  name="type"
                  label="Type"
                  required
                  options={ACCOMMODATION_TYPES.map((t) => ({
                    value: t,
                    label: t.charAt(0) + t.slice(1).toLowerCase(),
                  }))}
                  defaultValue={accommodation?.type ?? "APARTMENT"}
                  errors={errors.type}
                />
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  defaultValue={accommodation?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  options={RECORD_STATUSES.map((s) => ({ value: s, label: s }))}
                  defaultValue={accommodation?.status ?? "ACTIVE"}
                  errors={errors.status}
                />
                <TextField
                  name="city"
                  label="City"
                  defaultValue={accommodation?.city ?? ""}
                  errors={errors.city}
                />
                <TextField
                  name="addressLine"
                  label="Address"
                  defaultValue={accommodation?.addressLine ?? ""}
                  errors={errors.addressLine}
                />
              </div>

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={accommodation?.notes ?? ""}
                errors={errors.notes}
              />
            </div>

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
                {pending ? "Saving…" : accommodation ? "Save changes" : "Add property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
