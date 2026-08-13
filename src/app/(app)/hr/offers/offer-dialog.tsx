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
import { SELECTABLE_OFFER_STATUSES } from "@/lib/schemas/hiring";
import { createJobOfferAction, updateJobOfferAction } from "@/server/actions/hiring";

export type OfferValues = {
  id: string;
  companyId: string;
  candidateName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  positionId: string | null;
  jobDescriptionId: string | null;
  proposedSalary: string | null;
  currency: string;
  proposedJoiningDate: string | null;
  status: string;
  sentAt: string | null;
  notes: string | null;
  isConverted: boolean;
};

export function OfferDialog({
  companies,
  positions,
  descriptions,
  offer,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  descriptions: { id: string; title: string }[];
  offer?: OfferValues | undefined;
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
  const [status, setStatus] = React.useState(offer?.status ?? "DRAFT");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      candidateName: readString(fd, "candidateName"),
      candidateEmail: readString(fd, "candidateEmail"),
      candidatePhone: readString(fd, "candidatePhone"),
      positionId: readString(fd, "positionId"),
      jobDescriptionId: readString(fd, "jobDescriptionId"),
      proposedSalary: readString(fd, "proposedSalary"),
      currency: readString(fd, "currency") || "SAR",
      proposedJoiningDate: readString(fd, "proposedJoiningDate"),
      status,
      sentAt: readString(fd, "sentAt"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = offer
        ? await updateJobOfferAction({ ...values, id: offer.id })
        : await createJobOfferAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(offer ? "Offer updated." : "Offer created.");
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
          New offer
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{offer ? "Edit offer" : "New offer"}</DialogTitle>
              <DialogDescription>
                Marking an offer accepted does not create an employee — use Convert for
                that, once.
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
                  name="candidateName"
                  label="Candidate name"
                  required
                  defaultValue={offer?.candidateName ?? ""}
                  errors={errors.candidateName}
                />
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  defaultValue={offer?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <TextField
                  name="candidateEmail"
                  label="Email"
                  type="email"
                  defaultValue={offer?.candidateEmail ?? ""}
                  errors={errors.candidateEmail}
                />
                <TextField
                  name="candidatePhone"
                  label="Phone"
                  defaultValue={offer?.candidatePhone ?? ""}
                  errors={errors.candidatePhone}
                />
                <SelectField
                  name="positionId"
                  label="Position"
                  placeholder="Not specified"
                  options={positions.map((p) => ({ value: p.id, label: p.title }))}
                  defaultValue={offer?.positionId ?? ""}
                  errors={errors.positionId}
                />
                <SelectField
                  name="jobDescriptionId"
                  label="Job description"
                  placeholder="Not attached"
                  options={descriptions.map((d) => ({ value: d.id, label: d.title }))}
                  defaultValue={offer?.jobDescriptionId ?? ""}
                  errors={errors.jobDescriptionId}
                />
                <TextField
                  name="proposedSalary"
                  label="Proposed salary"
                  defaultValue={offer?.proposedSalary ?? ""}
                  errors={errors.proposedSalary}
                />
                <TextField
                  name="currency"
                  label="Currency"
                  defaultValue={offer?.currency ?? "SAR"}
                  errors={errors.currency}
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
                    {SELECTABLE_OFFER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.status?.[0] ? (
                    <p className="text-destructive text-xs">{errors.status[0]}</p>
                  ) : null}
                </div>

                <DateField
                  name="sentAt"
                  label="Sent on"
                  required={status !== "DRAFT"}
                  {...(status === "DRAFT" ? { hint: "Optional while a draft." } : {})}
                  defaultValue={offer?.sentAt ?? ""}
                  errors={errors.sentAt}
                />
                <DateField
                  name="proposedJoiningDate"
                  label="Proposed joining date"
                  defaultValue={offer?.proposedJoiningDate ?? ""}
                  errors={errors.proposedJoiningDate}
                  className="sm:col-span-2"
                />
              </div>

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={offer?.notes ?? ""}
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
                {pending ? "Saving…" : offer ? "Save changes" : "Create offer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
