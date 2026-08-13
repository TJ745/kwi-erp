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
import {
  CORRESPONDENCE_STATUSES,
  CORRESPONDENCE_TYPES,
} from "@/lib/schemas/hr-records";
import {
  createCorrespondenceAction,
  updateCorrespondenceAction,
} from "@/server/actions/hr-records";

export type CorrespondenceValues = {
  id: string;
  companyId: string;
  employeeId: string | null;
  type: string;
  subject: string;
  recipient: string;
  sentDate: string | null;
  status: string;
  followUpDate: string | null;
  notes: string | null;
};

export function CorrespondenceDialog({
  companies,
  employees,
  item,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  employees: { id: string; fullName: string; employeeNo: string }[];
  item?: CorrespondenceValues | undefined;
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

  // The schema requires a sent date for anything past DRAFT, and a follow-up
  // date when the status says one is needed. Tracking status here lets the
  // form say so before submitting rather than after.
  const [status, setStatus] = React.useState(item?.status ?? "DRAFT");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      employeeId: readString(fd, "employeeId"),
      type: readString(fd, "type"),
      subject: readString(fd, "subject"),
      recipient: readString(fd, "recipient"),
      sentDate: readString(fd, "sentDate"),
      status,
      followUpDate: readString(fd, "followUpDate"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = item
        ? await updateCorrespondenceAction({ ...values, id: item.id })
        : await createCorrespondenceAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(item ? "Correspondence updated." : "Correspondence logged.");
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
          Log correspondence
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {item ? "Edit correspondence" : "Log correspondence"}
              </DialogTitle>
              <DialogDescription>
                Anything past draft needs the date it was sent, so it can be evidenced
                later.
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

              <TextField
                name="subject"
                label="Subject"
                required
                defaultValue={item?.subject ?? ""}
                errors={errors.subject}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="recipient"
                  label="Recipient"
                  required
                  hint="The office, company, or person it went to."
                  defaultValue={item?.recipient ?? ""}
                  errors={errors.recipient}
                />
                <SelectField
                  name="type"
                  label="Type"
                  required
                  options={CORRESPONDENCE_TYPES.map((t) => ({
                    value: t,
                    label: t.replace(/_/g, " ").toLowerCase(),
                  }))}
                  defaultValue={item?.type ?? "GOVERNMENT"}
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
                  defaultValue={item?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <SelectField
                  name="employeeId"
                  label="About employee"
                  placeholder="Not about a specific employee"
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.fullName} · ${e.employeeNo}`,
                  }))}
                  defaultValue={item?.employeeId ?? ""}
                  errors={errors.employeeId}
                />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="field-status">
                    Status<span className="text-destructive">*</span>
                  </label>
                  <select
                    id="field-status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                    }}
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  >
                    {CORRESPONDENCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  {errors.status?.[0] ? (
                    <p className="text-destructive text-xs">{errors.status[0]}</p>
                  ) : null}
                </div>

                <DateField
                  name="sentDate"
                  label="Sent date"
                  required={status !== "DRAFT"}
                  {...(status === "DRAFT"
                    ? { hint: "Optional while it is still a draft." }
                    : {})}
                  defaultValue={item?.sentDate ?? ""}
                  errors={errors.sentDate}
                />
                <DateField
                  name="followUpDate"
                  label="Follow up on"
                  required={status === "FOLLOW_UP_REQUIRED"}
                  {...(status === "FOLLOW_UP_REQUIRED"
                    ? { hint: "Required — this is what surfaces it again." }
                    : {})}
                  defaultValue={item?.followUpDate ?? ""}
                  errors={errors.followUpDate}
                  className="sm:col-span-2"
                />
              </div>

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={item?.notes ?? ""}
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
                {pending ? "Saving…" : item ? "Save changes" : "Log correspondence"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
