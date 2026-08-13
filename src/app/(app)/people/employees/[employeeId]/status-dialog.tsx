"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
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
import { EMPLOYEE_STATUSES, LEAVING_STATUSES } from "@/lib/schemas/employee";
import { setEmployeeStatusAction } from "@/server/actions/employees";

const titleCase = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/**
 * The employee status transition (brief §50) — an employee is never deleted,
 * only transitioned. A leaving status requires a last working date, because
 * offboarding, final settlement, and the leavers report all key off it.
 */
export function EmployeeStatusDialog({
  employee,
}: {
  employee: { id: string; fullName: string; status: string; lastWorkingDate: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [status, setStatus] = React.useState(employee.status);

  const isLeaving = (LEAVING_STATUSES as readonly string[]).includes(status);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await setEmployeeStatusAction({
        id: employee.id,
        status,
        lastWorkingDate: readString(fd, "lastWorkingDate"),
        reason: readString(fd, "reason"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(`${employee.fullName} is now ${titleCase(status)}.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <UserCog />
        Change status
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setStatus(employee.status);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Employees are never deleted — their status is transitioned and the change is
              recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <SelectField
              name="status"
              label="Status"
              required
              defaultValue={employee.status}
              onChange={setStatus}
              options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
              errors={errors.status}
            />

            <DateField
              name="lastWorkingDate"
              label="Last working date"
              required={isLeaving}
              hint={
                isLeaving
                  ? "Required — offboarding and the leavers report depend on it."
                  : "Only relevant once the employee leaves."
              }
              defaultValue={employee.lastWorkingDate ?? ""}
              errors={errors.lastWorkingDate}
            />

            <TextAreaField
              name="reason"
              label="Reason"
              hint="Recorded on the audit entry."
              errors={errors.reason}
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
                {pending ? "Saving…" : "Change status"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
