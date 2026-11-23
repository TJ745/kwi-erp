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
import { DateField, SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { CLEARANCE_SECTIONS } from "@/lib/recruitment-forms";
import type { ClearanceDetails } from "@/lib/schemas/recruitment";
import {
  clearanceDefaultsAction,
  createClearanceAction,
  updateClearanceAction,
} from "@/server/actions/recruitment";

export type ClearanceValues = {
  id: string;
  employeeId: string;
  formDate: string;
  endDate: string;
  details: ClearanceDetails;
};

type Start = { formDate: string; endDate: string; details: ClearanceDetails };

const today = () => new Date().toISOString().slice(0, 10);

const HEAD_FIELDS = [
  ["companyName", "Company name"],
  ["location", "Company location"],
  ["department", "Department / Division"],
  ["position", "Position"],
  ["departmentManager", "Department manager"],
] as const;

/**
 * Employee Clearance Form. Pick the employee: their company, department,
 * manager and everything they still hold (IT equipment, phone, vehicle,
 * bed) fill in, N/A otherwise. All of it can be changed before saving.
 */
export function ClearanceDialog({
  employees,
  form,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  /** Absent for create. */
  form?: ClearanceValues;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState(form?.employeeId ?? "");
  const [start, setStart] = React.useState<Start | null>(form ?? null);
  const [loading, setLoading] = React.useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEmployeeId(form?.employeeId ?? "");
      setStart(form ?? null);
      setErrors({});
      setFormError(null);
    }
  }

  function pick(id: string) {
    setEmployeeId(id);
    setStart(null);
    if (!id) return;
    setLoading(true);
    void clearanceDefaultsAction({ employeeId: id }).then((result) => {
      setLoading(false);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setStart({ formDate: today(), endDate: result.data.endDate, details: result.data.details });
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const details = {
      ...Object.fromEntries(HEAD_FIELDS.map(([k]) => [k, readString(fd, k)])),
      lines: Object.fromEntries(
        CLEARANCE_SECTIONS.flatMap((s) =>
          s.lines.map((l) => [
            l.key,
            { value: readString(fd, `l_${l.key}_v`), name: readString(fd, `l_${l.key}_n`) },
          ]),
        ),
      ),
      signers: Object.fromEntries(
        CLEARANCE_SECTIONS.map((s) => [s.key, readString(fd, `s_${s.key}`)]),
      ),
    };
    const payload = {
      employeeId,
      formDate: readString(fd, "formDate"),
      endDate: readString(fd, "endDate"),
      details,
    };
    startTransition(async () => {
      const result = form
        ? await updateClearanceAction({ ...payload, id: form.id })
        : await createClearanceAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? "Please check the highlighted fields." : result.error);
        return;
      }
      toast.success(form ? "Clearance form updated." : "Clearance form created.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {form ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Edit"
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <Plus />
          New clearance form
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form ? "Edit clearance form" : "New clearance form"}</DialogTitle>
            <DialogDescription>
              Pick the employee: their details and what they still hold fill in from the system.
              Anything they do not hold reads N/A.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}
            {form ? null : (
              <SelectField
                name="employeePick"
                label="Employee"
                required
                options={employees.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} · ${e.employeeNo}`,
                }))}
                onChange={pick}
                errors={errors.employeeId}
                {...(loading ? { hint: "Loading the employee's details…" } : {})}
              />
            )}

            {start ? (
              <div key={employeeId} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateField
                    name="formDate"
                    label="Date"
                    required
                    defaultValue={start.formDate}
                    errors={errors.formDate}
                  />
                  <DateField
                    name="endDate"
                    label="End date (last working day)"
                    defaultValue={start.endDate}
                    errors={errors.endDate}
                  />
                  {HEAD_FIELDS.map(([k, label]) => (
                    <TextField key={k} name={k} label={label} defaultValue={start.details[k]} />
                  ))}
                </div>

                {CLEARANCE_SECTIONS.map((s) => (
                  <fieldset key={s.key} className="space-y-3 rounded-md border p-3">
                    <legend className="px-1 text-sm font-semibold">{s.en}</legend>
                    {s.lines.map((l) => (
                      <div key={l.key} className={l.named ? "grid gap-3 sm:grid-cols-2" : ""}>
                        <TextField
                          name={`l_${l.key}_v`}
                          label={l.en}
                          defaultValue={start.details.lines[l.key]?.value ?? ""}
                        />
                        {l.named ? (
                          <TextField
                            name={`l_${l.key}_n`}
                            label={`${l.en} — name`}
                            defaultValue={start.details.lines[l.key]?.name ?? ""}
                          />
                        ) : null}
                      </div>
                    ))}
                    <TextField
                      name={`s_${s.key}`}
                      label={`${s.signerEn} (name)`}
                      defaultValue={start.details.signers[s.key] ?? ""}
                    />
                  </fieldset>
                ))}
              </div>
            ) : null}

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
              <Button type="submit" disabled={pending || !start}>
                {pending ? "Saving…" : form ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
