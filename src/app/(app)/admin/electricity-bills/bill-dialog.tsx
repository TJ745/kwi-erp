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
import { BILL_STATUSES } from "@/lib/schemas/compliance";
import { createBillAction, updateBillAction } from "@/server/actions/compliance";

export type BillValues = {
  id: string;
  companyId: string;
  accommodationId: string | null;
  location: string;
  meterNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amount: string;
  currency: string;
  dueDate: string;
  paidDate: string | null;
  status: string;
  notes: string | null;
};

export function BillDialog({
  companies,
  accommodations,
  bill,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  accommodations: { id: string; name: string; companyId: string }[];
  bill?: BillValues | undefined;
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

  // The payment date only applies to a paid bill, and the schema rejects the
  // mismatch — so the field appears and disappears with the status rather than
  // letting the user submit something that will bounce.
  const [status, setStatus] = React.useState(bill?.status ?? "PENDING");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      accommodationId: readString(fd, "accommodationId"),
      location: readString(fd, "location"),
      meterNumber: readString(fd, "meterNumber"),
      billingPeriodStart: readString(fd, "billingPeriodStart"),
      billingPeriodEnd: readString(fd, "billingPeriodEnd"),
      amount: readString(fd, "amount"),
      currency: readString(fd, "currency") || "SAR",
      dueDate: readString(fd, "dueDate"),
      paidDate: readString(fd, "paidDate"),
      status,
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = bill
        ? await updateBillAction({ ...values, id: bill.id })
        : await createBillAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(bill ? "Bill updated." : "Bill added.");
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
          Add bill
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{bill ? "Edit bill" : "Add bill"}</DialogTitle>
              <DialogDescription>
                One bill per meter per billing period — the database enforces it.
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
                  name="location"
                  label="Location"
                  required
                  defaultValue={bill?.location ?? ""}
                  errors={errors.location}
                />
                <TextField
                  name="meterNumber"
                  label="Meter number"
                  required
                  defaultValue={bill?.meterNumber ?? ""}
                  errors={errors.meterNumber}
                />
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  defaultValue={bill?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <SelectField
                  name="accommodationId"
                  label="Accommodation"
                  placeholder="Not linked"
                  hint="Optional — links the bill to a specific property."
                  options={accommodations.map((a) => ({ value: a.id, label: a.name }))}
                  defaultValue={bill?.accommodationId ?? ""}
                  errors={errors.accommodationId}
                />
                <DateField
                  name="billingPeriodStart"
                  label="Period start"
                  required
                  defaultValue={bill?.billingPeriodStart ?? ""}
                  errors={errors.billingPeriodStart}
                />
                <DateField
                  name="billingPeriodEnd"
                  label="Period end"
                  required
                  defaultValue={bill?.billingPeriodEnd ?? ""}
                  errors={errors.billingPeriodEnd}
                />
                <TextField
                  name="amount"
                  label="Amount"
                  required
                  hint="Numbers only."
                  defaultValue={bill?.amount ?? ""}
                  errors={errors.amount}
                />
                <TextField
                  name="currency"
                  label="Currency"
                  defaultValue={bill?.currency ?? "SAR"}
                  errors={errors.currency}
                />
                <DateField
                  name="dueDate"
                  label="Due date"
                  required
                  defaultValue={bill?.dueDate ?? ""}
                  errors={errors.dueDate}
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
                    {BILL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.status?.[0] ? (
                    <p className="text-destructive text-xs">{errors.status[0]}</p>
                  ) : null}
                </div>

                {status === "PAID" ? (
                  <DateField
                    name="paidDate"
                    label="Payment date"
                    required
                    defaultValue={bill?.paidDate ?? ""}
                    errors={errors.paidDate}
                  />
                ) : (
                  // Cleared when the status is not PAID, so an old payment date
                  // cannot linger on a bill that has been reopened.
                  <input type="hidden" name="paidDate" value="" />
                )}
              </div>

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={bill?.notes ?? ""}
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
                {pending ? "Saving…" : bill ? "Save changes" : "Add bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
