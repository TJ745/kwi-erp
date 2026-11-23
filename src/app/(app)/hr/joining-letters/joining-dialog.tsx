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
import { createJoiningLetterAction, updateJoiningLetterAction } from "@/server/actions/recruitment";

export type JoiningEmployee = {
  id: string;
  fullName: string;
  employeeNo: string;
  joiningDate: string;
  positionTitle: string;
  section: string;
};

export type JoiningValues = {
  id: string;
  employeeId: string;
  letterDate: string;
  joiningDate: string;
  positionTitle: string;
  section: string;
  remarks: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/** New Appointment Acknowledgment: pick the employee, the rest fills in. */
export function JoiningDialog({
  employees,
  letter,
}: {
  employees: JoiningEmployee[];
  /** Absent for create. */
  letter?: JoiningValues;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState(letter?.employeeId ?? "");
  const picked = employees.find((e) => e.id === employeeId);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEmployeeId(letter?.employeeId ?? "");
      setErrors({});
      setFormError(null);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const payload = {
      employeeId,
      letterDate: readString(fd, "letterDate"),
      joiningDate: readString(fd, "joiningDate"),
      positionTitle: readString(fd, "positionTitle"),
      section: readString(fd, "section"),
      remarks: readString(fd, "remarks"),
    };
    startTransition(async () => {
      const result = letter
        ? await updateJoiningLetterAction({ ...payload, id: letter.id })
        : await createJoiningLetterAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success(letter ? "Joining letter updated." : "Joining letter created.");
      setOpen(false);
      router.refresh();
    });
  }

  // Edit keeps what was saved; a newly picked employee brings their record.
  const values =
    letter && employeeId === letter.employeeId
      ? letter
      : {
          letterDate: today(),
          joiningDate: picked?.joiningDate ?? "",
          positionTitle: picked?.positionTitle ?? "",
          section: picked?.section ?? "",
          remarks: "",
        };

  return (
    <>
      {letter ? (
        <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => onOpenChange(true)}>
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button onClick={() => onOpenChange(true)}>
          <Plus />
          New joining letter
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{letter ? "Edit joining letter" : "New joining letter"}</DialogTitle>
            <DialogDescription>
              New Appointment Acknowledgment. Pick the employee: name, number, position, section and
              joining date fill in from their record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}
            <SelectField
              name="employeePick"
              label="Employee"
              required
              defaultValue={employeeId}
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.fullName} · ${e.employeeNo}`,
              }))}
              onChange={setEmployeeId}
              errors={errors.employeeId}
            />
            {employeeId ? (
              <div key={employeeId} className="grid gap-4 sm:grid-cols-2">
                <DateField
                  name="letterDate"
                  label="Date"
                  required
                  defaultValue={values.letterDate}
                  errors={errors.letterDate}
                />
                <DateField
                  name="joiningDate"
                  label="Joining date"
                  required
                  defaultValue={values.joiningDate}
                  errors={errors.joiningDate}
                />
                <TextField
                  name="positionTitle"
                  label="Position"
                  defaultValue={values.positionTitle}
                  errors={errors.positionTitle}
                />
                <TextField
                  name="section"
                  label="Section"
                  hint="e.g. KWI-RIYADH"
                  defaultValue={values.section}
                  errors={errors.section}
                />
                <TextAreaField
                  name="remarks"
                  label="Remarks"
                  defaultValue={values.remarks ?? ""}
                  errors={errors.remarks}
                  className="sm:col-span-2"
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !employeeId}>
                {pending ? "Saving…" : letter ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
