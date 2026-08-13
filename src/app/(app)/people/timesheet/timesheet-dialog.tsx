"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { validateHours } from "@/lib/timesheet";
import {
  createTimesheetEntryAction,
  updateTimesheetEntryAction,
} from "@/server/actions/hiring";

export type TimesheetValues = {
  id: string;
  employeeId: string;
  date: string;
  normalHours: string;
  overtimeHours: string;
  delayedHours: string;
  absent: boolean;
  notes: string | null;
  status: string;
};

export function TimesheetDialog({
  employees,
  entry,
  defaultDate,
  open: controlledOpen,
  onOpenChange,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  entry?: TimesheetValues | undefined;
  defaultDate?: string | undefined;
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

  const [absent, setAbsent] = React.useState(entry?.absent ?? false);
  const [normal, setNormal] = React.useState(entry?.normalHours ?? "8");
  const [overtime, setOvertime] = React.useState(entry?.overtimeHours ?? "0");
  const [delayed, setDelayed] = React.useState(entry?.delayedHours ?? "0");

  // Checked with the SAME function the server enforces, so the form and the
  // service cannot disagree about what a valid day is.
  const problems = React.useMemo(
    () =>
      validateHours({
        normalHours: normal || "0",
        overtimeHours: overtime || "0",
        delayedHours: delayed || "0",
        absent,
      }),
    [normal, overtime, delayed, absent],
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      employeeId: readString(fd, "employeeId"),
      date: readString(fd, "date"),
      // An absent day is zero hours by definition; sending whatever was typed
      // before the box was ticked would be rejected by the same rule.
      normalHours: absent ? "0" : normal || "0",
      overtimeHours: absent ? "0" : overtime || "0",
      delayedHours: delayed || "0",
      absent,
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = entry
        ? await updateTimesheetEntryAction({ ...values, id: entry.id })
        : await createTimesheetEntryAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(entry ? "Entry updated." : "Hours recorded.");
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
          Record hours
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{entry ? "Edit hours" : "Record hours"}</DialogTitle>
              <DialogDescription>
                One entry per person per day. Entries start pending and only count towards
                payroll totals once approved.
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
                  defaultValue={entry?.employeeId ?? ""}
                  errors={errors.employeeId}
                />
                <DateField
                  name="date"
                  label="Date"
                  required
                  defaultValue={entry?.date ?? defaultDate ?? ""}
                  errors={errors.date}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="absent"
                  checked={absent}
                  onCheckedChange={(checked) => {
                    setAbsent(checked === true);
                  }}
                />
                <Label htmlFor="absent" className="font-normal">
                  Absent — no hours worked this day
                </Label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name="normalHours"
                  label="Normal hours"
                  defaultValue={entry?.normalHours ?? "8"}
                  onChange={setNormal}
                  errors={errors.normalHours}
                />
                <TextField
                  name="overtimeHours"
                  label="Overtime hours"
                  defaultValue={entry?.overtimeHours ?? "0"}
                  onChange={setOvertime}
                  errors={errors.overtimeHours}
                />
                <TextField
                  name="delayedHours"
                  label="Delayed hours"
                  hint="Late arrival or early departure."
                  defaultValue={entry?.delayedHours ?? "0"}
                  onChange={setDelayed}
                  errors={errors.delayedHours}
                />
              </div>

              {problems.length > 0 ? (
                <ul
                  role="alert"
                  className="border-status-warning/40 bg-status-warning/5 space-y-1 rounded-md border p-3 text-xs"
                >
                  {problems.map((p) => (
                    <li key={`${p.field}-${p.message}`}>{p.message}</li>
                  ))}
                </ul>
              ) : null}

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={entry?.notes ?? ""}
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
              <Button type="submit" disabled={pending || problems.length > 0}>
                {pending ? "Saving…" : entry ? "Save changes" : "Record hours"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
