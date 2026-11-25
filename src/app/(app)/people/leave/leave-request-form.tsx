"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Pencil, Plus } from "lucide-react";
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
import { ChoiceGroup } from "@/components/forms/choice-group";
import { readString } from "@/lib/form-data";
import { countLeaveDays } from "@/lib/leave-rules";
import type { LeaveForm } from "@/lib/leave-form";
import {
  createLeaveRequestAction,
  leaveDefaultsAction,
  updateLeaveRequestAction,
} from "@/server/actions/hr";

type LeaveType = { id: string; name: string; isPaid: boolean; maxDaysPerYear: number | null };

export type LeaveValues = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  handoverToId: string | null;
  form: LeaveForm;
};

const FORM_TEXT: { key: keyof LeaveForm; label: string; wide?: boolean }[] = [
  { key: "country", label: "Country" },
  { key: "destination", label: "Destination" },
  { key: "homeAddress", label: "Home address", wide: true },
  { key: "poBox", label: "P.O. Box" },
  { key: "cityCountry", label: "City / Country" },
  { key: "telHome", label: "Tel. no. home" },
  { key: "telRelative", label: "Tel. no. relative" },
  { key: "email", label: "E-mail address", wide: true },
];

const ADMIN_TEXT: { key: keyof LeaveForm; label: string }[] = [
  { key: "leaveDueEvery", label: "Leave due every" },
  { key: "lastArrival", label: "Arrival from last vacation (dd/mm/yyyy)" },
  { key: "ticketsSelf", label: "Tickets due — self" },
  { key: "ticketsWife", label: "Tickets due — wife" },
  { key: "ticketsChildren", label: "Tickets due — children" },
];

const today = () => new Date().toISOString().slice(0, 10);

/** The day after an ISO date, as an ISO date. */
const dayAfter = (iso: string) =>
  new Date(new Date(iso).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Records an employee's leave, printed as the company's Leave Request form.
 * Leave entered here is approved as it is saved: HR records agreed leave.
 */
export function LeaveRequestButton({
  leaveTypes,
  employees,
  leave: given,
  extend,
}: {
  leaveTypes: LeaveType[];
  employees: { id: string; label: string }[];
  /** Absent for a new leave. */
  leave?: LeaveValues;
  /** Records a new leave that carries on from this one. */
  extend?: LeaveValues;
}) {
  // An extension starts as a copy of the leave it extends, from the day after
  // it ends, and is then recorded as a new leave.
  const leave: LeaveValues | undefined = extend
    ? { ...extend, startDate: dayAfter(extend.endDate), endDate: dayAfter(extend.endDate) }
    : given;
  const editing = Boolean(given);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState(leave?.employeeId ?? "");
  const [defaults, setDefaults] = React.useState<LeaveForm | null>(leave?.form ?? null);
  const [loading, setLoading] = React.useState(false);
  const [start, setStart] = React.useState(leave?.startDate ?? today());
  const [end, setEnd] = React.useState(leave?.endDate ?? today());

  const days = start && end && end >= start ? countLeaveDays(new Date(start), new Date(end)) : null;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEmployeeId(leave?.employeeId ?? "");
      setDefaults(leave?.form ?? null);
      setStart(leave?.startDate ?? today());
      setEnd(leave?.endDate ?? today());
      setErrors({});
      setFormError(null);
    }
  }

  function pickEmployee(id: string) {
    setEmployeeId(id);
    setDefaults(null);
    if (!id) return;
    setLoading(true);
    void leaveDefaultsAction({ employeeId: id }).then((result) => {
      setLoading(false);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setDefaults(result.data);
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const s = (k: string) => readString(fd, k);
    const payload = {
      employeeId,
      leaveTypeId: s("leaveTypeId"),
      startDate: s("startDate"),
      endDate: s("endDate"),
      handoverToId: s("handoverToId"),
      ...(extend ? { extendsLeaveId: extend.id } : {}),
      form: {
        ...Object.fromEntries([...FORM_TEXT, ...ADMIN_TEXT].map((f) => [f.key, s(f.key)])),
        visaType: s("visaType"),
        visaPeriod: s("visaPeriod"),
        visaAccount: s("visaAccount"),
        specialRemarks: s("specialRemarks"),
      },
    };
    startTransition(async () => {
      const result = given
        ? await updateLeaveRequestAction({ ...payload, id: given.id })
        : await createLeaveRequestAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? "Please check the highlighted fields." : result.error);
        return;
      }
      toast.success(editing ? "Leave updated." : extend ? "Leave extended." : "Leave recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  const ready = defaults !== null && !loading;

  return (
    <>
      {extend ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Extend leave"
          title="Extend leave"
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <CalendarPlus className="size-4" />
        </Button>
      ) : leave ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Edit leave"
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
          New leave
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {extend ? "Extend leave" : editing ? "Edit leave" : "New leave"}
            </DialogTitle>
            <DialogDescription>
              {extend
                ? `Extends the leave of ${extend.startDate} to ${extend.endDate}. The extension starts the day after it ends; choose the new last day. It is recorded and printed as its own Leave Request.`
                : "Prints as the Leave Request form. Pick the employee: their details fill in from their record and contract. The leave is approved as it is saved."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}

            {leave ? null : (
              <SelectField
                name="employeePick"
                label="Employee"
                required
                options={employees.map((e) => ({ value: e.id, label: e.label }))}
                onChange={pickEmployee}
                errors={errors.employeeId}
                {...(loading ? { hint: "Loading the employee's details…" } : {})}
              />
            )}

            {ready ? (
              <div key={employeeId} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <SelectField
                    name="leaveTypeId"
                    label="Leave requested"
                    required
                    defaultValue={
                      leave?.leaveTypeId ??
                      leaveTypes.find((t) => t.name === "Annual Leave")?.id ??
                      ""
                    }
                    options={leaveTypes.map((t) => ({ value: t.id, label: t.name }))}
                    errors={errors.leaveTypeId}
                  />
                  <DateField
                    name="startDate"
                    label="From"
                    required
                    defaultValue={start}
                    {...(extend ? { hint: "The day after the leave ends." } : {})}
                    errors={errors.startDate}
                  />
                  <DateField
                    name="endDate"
                    label="To"
                    required
                    defaultValue={end}
                    errors={errors.endDate}
                  />
                </div>
                {/* Dates are mirrored into state for the live day count. */}
                <DateMirror name="startDate" onChange={setStart} />
                <DateMirror name="endDate" onChange={setEnd} />
                <p className="text-muted-foreground -mt-3 text-sm">
                  {days !== null
                    ? `${String(days)} day${days === 1 ? "" : "s"}`
                    : "The end date is before the start."}
                </p>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold">Travel and contact</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {FORM_TEXT.map((f) => (
                      <TextField
                        key={f.key}
                        name={f.key}
                        label={f.label}
                        defaultValue={defaults[f.key]}
                        errors={errors[`form.${f.key}`]}
                        className={f.wide ? "sm:col-span-2" : undefined}
                      />
                    ))}
                  </div>
                </fieldset>

                <SelectField
                  name="handoverToId"
                  label="Substitute employee"
                  placeholder="None"
                  defaultValue={leave?.handoverToId ?? ""}
                  options={employees
                    .filter((e) => e.id !== employeeId)
                    .map((e) => ({ value: e.id, label: e.label }))}
                  errors={errors.handoverToId}
                />

                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold">
                    Administration &amp; personnel use
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {ADMIN_TEXT.map((f) => (
                      <TextField
                        key={f.key}
                        name={f.key}
                        label={f.label}
                        defaultValue={defaults[f.key]}
                        errors={errors[`form.${f.key}`]}
                      />
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ChoiceGroup
                      name="visaType"
                      label="Exit re-entry visa"
                      defaultValue={defaults.visaType}
                      options={[
                        { value: "SINGLE", label: "Single" },
                        { value: "MULTIPLE", label: "Multiple 6 months" },
                        { value: "EXIT", label: "Exit" },
                      ]}
                    />
                    <TextField
                      name="visaPeriod"
                      label="Visa period"
                      defaultValue={defaults.visaPeriod}
                    />
                    <ChoiceGroup
                      name="visaAccount"
                      label="Visa paid by"
                      defaultValue={defaults.visaAccount}
                      options={[
                        { value: "EMPLOYEE", label: "Employee" },
                        { value: "COMPANY", label: "Company" },
                        { value: "OTHER", label: "Others" },
                      ]}
                    />
                  </div>
                  <TextAreaField
                    name="specialRemarks"
                    label="Special remarks"
                    defaultValue={defaults.specialRemarks}
                    rows={2}
                  />
                </fieldset>
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
              <Button type="submit" disabled={pending || !ready || days === null}>
                {pending ? "Saving…" : editing ? "Save" : extend ? "Extend leave" : "Record leave"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Follows a date input by name, so the day count updates as it changes
 * without making the field itself controlled.
 */
function DateMirror({ name, onChange }: { name: string; onChange: (v: string) => void }) {
  React.useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) return;
    const handler = () => {
      onChange(input.value);
    };
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
    return () => {
      input.removeEventListener("input", handler);
      input.removeEventListener("change", handler);
    };
  }, [name, onChange]);
  return null;
}
