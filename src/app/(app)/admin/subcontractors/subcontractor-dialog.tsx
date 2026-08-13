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
import { RECORD_STATUSES } from "@/lib/schemas/vendors";
import {
  createSubcontractorAction,
  updateSubcontractorAction,
} from "@/server/actions/vendors";

export type SubcontractorValues = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  crNumber: string | null;
  status: string;
  notes: string | null;
};

export function SubcontractorDialog({
  subcontractor,
  open: controlledOpen,
  onOpenChange,
}: {
  subcontractor?: SubcontractorValues | undefined;
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
      code: readString(fd, "code"),
      name: readString(fd, "name"),
      contactPerson: readString(fd, "contactPerson"),
      phone: readString(fd, "phone"),
      email: readString(fd, "email"),
      crNumber: readString(fd, "crNumber"),
      status: readString(fd, "status"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = subcontractor
        ? await updateSubcontractorAction({ ...values, id: subcontractor.id })
        : await createSubcontractorAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(subcontractor ? "Subcontractor updated." : "Subcontractor added.");
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
          Add subcontractor
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {subcontractor ? "Edit subcontractor" : "Add subcontractor"}
              </DialogTitle>
              <DialogDescription>
                Contracts are added from the subcontractor&apos;s own page.
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
                  name="code"
                  label="Code"
                  required
                  defaultValue={subcontractor?.code ?? ""}
                  errors={errors.code}
                />
                <TextField
                  name="name"
                  label="Company name"
                  required
                  defaultValue={subcontractor?.name ?? ""}
                  errors={errors.name}
                />
                <TextField
                  name="crNumber"
                  label="CR number"
                  defaultValue={subcontractor?.crNumber ?? ""}
                  errors={errors.crNumber}
                />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  options={RECORD_STATUSES.map((s) => ({ value: s, label: s }))}
                  defaultValue={subcontractor?.status ?? "ACTIVE"}
                  errors={errors.status}
                />
                <TextField
                  name="contactPerson"
                  label="Contact person"
                  defaultValue={subcontractor?.contactPerson ?? ""}
                  errors={errors.contactPerson}
                />
                <TextField
                  name="phone"
                  label="Phone"
                  defaultValue={subcontractor?.phone ?? ""}
                  errors={errors.phone}
                />
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={subcontractor?.email ?? ""}
                  errors={errors.email}
                  className="sm:col-span-2"
                />
              </div>

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={subcontractor?.notes ?? ""}
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
                {pending ? "Saving…" : subcontractor ? "Save changes" : "Add subcontractor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
