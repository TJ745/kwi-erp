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
import { WARNING_LEVELS } from "@/lib/schemas/hr-records";
import { createWarningAction, updateWarningAction } from "@/server/actions/hr-records";

export type WarningValues = {
  id: string;
  employeeId: string;
  level: string;
  reason: string;
  description: string;
  issuedDate: string;
  acknowledged: boolean;
};

export function WarningDialog({
  employees,
  warning,
  open: controlledOpen,
  onOpenChange,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  warning?: WarningValues | undefined;
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
      employeeId: readString(fd, "employeeId"),
      level: readString(fd, "level"),
      reason: readString(fd, "reason"),
      description: readString(fd, "description"),
      issuedDate: readString(fd, "issuedDate"),
    };

    startTransition(async () => {
      const result = warning
        ? await updateWarningAction({ ...values, id: warning.id })
        : await createWarningAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(warning ? "Warning updated." : "Warning issued.");
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
          Issue warning
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{warning ? "Edit warning" : "Issue warning"}</DialogTitle>
              <DialogDescription>
                Levels escalate verbal → first → second → final, but the choice is yours:
                gross misconduct can go straight to final.
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
                <SelectField
                  name="employeeId"
                  label="Employee"
                  required
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.fullName} · ${e.employeeNo}`,
                  }))}
                  defaultValue={warning?.employeeId ?? ""}
                  errors={errors.employeeId}
                />
                <SelectField
                  name="level"
                  label="Level"
                  required
                  options={WARNING_LEVELS.map((l) => ({
                    value: l,
                    label: l.replace(/_/g, " "),
                  }))}
                  defaultValue={warning?.level ?? "VERBAL"}
                  errors={errors.level}
                />
                <DateField
                  name="issuedDate"
                  label="Issued date"
                  required
                  defaultValue={
                    warning?.issuedDate ?? new Date().toISOString().slice(0, 10)
                  }
                  errors={errors.issuedDate}
                  className="sm:col-span-2"
                />
              </div>

              <TextField
                name="reason"
                label="Reason"
                required
                hint="A short summary — this is what appears in the list."
                defaultValue={warning?.reason ?? ""}
                errors={errors.reason}
              />
              <TextAreaField
                name="description"
                label="What happened"
                required
                rows={6}
                hint="The full account. This is the text the employee acknowledges."
                defaultValue={warning?.description ?? ""}
                errors={errors.description}
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
                {pending ? "Saving…" : warning ? "Save changes" : "Issue warning"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
