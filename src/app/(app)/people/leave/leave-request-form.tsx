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
import { DateField, SelectField, TextAreaField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createLeaveRequestAction } from "@/server/actions/hr";

type LeaveType = { id: string; name: string; isPaid: boolean; maxDaysPerYear: number | null };

export function LeaveRequestButton({
  leaveTypes,
  employees,
  ownEmployeeId,
}: {
  leaveTypes: LeaveType[];
  /** Empty when the actor may only request for themselves. */
  employees: { id: string; label: string }[];
  ownEmployeeId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const mustPickEmployee = employees.length > 0;
  const canSubmit = mustPickEmployee || Boolean(ownEmployeeId);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createLeaveRequestAction({
        employeeId: mustPickEmployee ? readString(fd, "employeeId") : (ownEmployeeId ?? ""),
        leaveTypeId: readString(fd, "leaveTypeId"),
        startDate: readString(fd, "startDate"),
        endDate: readString(fd, "endDate"),
        reason: readString(fd, "reason"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success("Leave request submitted.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        disabled={!canSubmit}
        title={canSubmit ? undefined : "Your user account is not linked to an employee record."}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus />
        Request leave
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>
              Days are counted inclusively. Overlapping pending or approved requests are
              rejected.
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

            {mustPickEmployee ? (
              <SelectField
                name="employeeId"
                label="Employee"
                required
                defaultValue={ownEmployeeId ?? ""}
                options={employees.map((e) => ({ value: e.id, label: e.label }))}
                errors={errors.employeeId}
              />
            ) : null}

            <SelectField
              name="leaveTypeId"
              label="Leave type"
              required
              options={leaveTypes.map((t) => ({
                value: t.id,
                label: t.maxDaysPerYear
                  ? `${t.name} (max ${String(t.maxDaysPerYear)} days/year)`
                  : t.name,
              }))}
              errors={errors.leaveTypeId}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <DateField name="startDate" label="From" required errors={errors.startDate} />
              <DateField name="endDate" label="To" required errors={errors.endDate} />
            </div>

            <TextAreaField name="reason" label="Reason" errors={errors.reason} />

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
                {pending ? "Submitting…" : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
