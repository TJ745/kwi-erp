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
import { incrementFigures } from "@/lib/hr-calc";
import { createIncrementAction, updateIncrementAction } from "@/server/actions/hr-records";

export type IncrementValues = {
  id: string;
  employeeId: string;
  employeeName: string;
  currentSalary: string;
  newSalary: string;
  currency: string;
  effectiveDate: string;
  notes: string | null;
  status: string;
  isOwnRequest: boolean;
};

export function IncrementDialog({
  employees,
  increment,
  open: controlledOpen,
  onOpenChange,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  increment?: IncrementValues | undefined;
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

  // Previewed with the SAME function the server uses, so what the requester
  // sees and what gets stored cannot disagree.
  const [current, setCurrent] = React.useState(increment?.currentSalary ?? "");
  const [next, setNext] = React.useState(increment?.newSalary ?? "");
  const preview = React.useMemo(
    () => (current && next ? incrementFigures(current, next) : null),
    [current, next],
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      employeeId: readString(fd, "employeeId"),
      currentSalary: readString(fd, "currentSalary"),
      newSalary: readString(fd, "newSalary"),
      currency: readString(fd, "currency") || "SAR",
      effectiveDate: readString(fd, "effectiveDate"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = increment
        ? await updateIncrementAction({ ...values, id: increment.id })
        : await createIncrementAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(increment ? "Increment updated." : "Increment requested.");
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
          Request increment
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {increment ? "Edit increment" : "Request increment"}
              </DialogTitle>
              <DialogDescription>
                Approving this updates the employee&apos;s active contract, so a salary
                letter issued afterwards quotes the new figure.
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
                label="Employee"
                required
                options={employees.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} · ${e.employeeNo}`,
                }))}
                defaultValue={increment?.employeeId ?? ""}
                errors={errors.employeeId}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name="currentSalary"
                  label="Current salary"
                  required
                  defaultValue={increment?.currentSalary ?? ""}
                  errors={errors.currentSalary}
                  onChange={setCurrent}
                />
                <TextField
                  name="newSalary"
                  label="New salary"
                  required
                  defaultValue={increment?.newSalary ?? ""}
                  errors={errors.newSalary}
                  onChange={setNext}
                />
                <TextField
                  name="currency"
                  label="Currency"
                  defaultValue={increment?.currency ?? "SAR"}
                  errors={errors.currency}
                />
              </div>

              {preview ? (
                <div className="bg-muted/40 rounded-md p-3 text-sm">
                  <span className="text-muted-foreground">Increase: </span>
                  <span className="font-medium tabular-nums">
                    {Number(preview.amount) >= 0 ? "+" : ""}
                    {preview.amount}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-medium tabular-nums">{preview.percentage}%</span>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Computed on the server from the two salaries — not editable.
                  </p>
                </div>
              ) : null}

              <DateField
                name="effectiveDate"
                label="Effective date"
                required
                defaultValue={
                  increment?.effectiveDate ?? new Date().toISOString().slice(0, 10)
                }
                errors={errors.effectiveDate}
              />
              <TextAreaField
                name="notes"
                label="Justification"
                defaultValue={increment?.notes ?? ""}
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
                {pending ? "Saving…" : increment ? "Save changes" : "Request increment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
