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
import { PAYMENT_METHODS } from "@/lib/schemas/petty-cash";
import {
  createTransactionAction,
  updateTransactionAction,
} from "@/server/actions/petty-cash";

export type TransactionValues = {
  id: string;
  accountId: string;
  date: string;
  type: string;
  categoryId: string;
  description: string;
  amount: string;
  paymentMethod: string;
  requesterId: string | null;
  notes: string | null;
  isOwnRequest: boolean;
};

export function TransactionDialog({
  accountId,
  currency,
  categories,
  employees,
  transaction,
  open: controlledOpen,
  onOpenChange,
}: {
  accountId: string;
  currency: string;
  categories: { id: string; name: string; type: string }[];
  employees: { id: string; fullName: string; employeeNo: string }[];
  transaction?: TransactionValues | undefined;
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

  // The category list is filtered by type, because the service rejects a
  // mismatch — offering a fuel category on an income entry would only produce
  // a failed submit.
  const [type, setType] = React.useState(transaction?.type ?? "EXPENSE");
  const available = categories.filter((c) => c.type === type);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      accountId,
      date: readString(fd, "date"),
      type,
      categoryId: readString(fd, "categoryId"),
      description: readString(fd, "description"),
      amount: readString(fd, "amount"),
      paymentMethod: readString(fd, "paymentMethod"),
      requesterId: readString(fd, "requesterId"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = transaction
        ? await updateTransactionAction({ ...values, id: transaction.id })
        : await createTransactionAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(transaction ? "Transaction updated." : "Transaction raised for approval.");
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
          Record transaction
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {transaction ? "Edit transaction" : "Record transaction"}
              </DialogTitle>
              <DialogDescription>
                Entries start as pending and do not move the balance until someone with
                approval rights — not you — approves them.
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="field-type">
                    Type<span className="text-destructive">*</span>
                  </label>
                  <select
                    id="field-type"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                    }}
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  >
                    <option value="EXPENSE">Expense — money out</option>
                    <option value="INCOME">Income — money in</option>
                  </select>
                </div>

                <SelectField
                  // Remounts when the type changes so the previous selection
                  // cannot survive into a list that no longer contains it.
                  key={type}
                  name="categoryId"
                  label="Category"
                  required
                  options={available.map((c) => ({ value: c.id, label: c.name }))}
                  defaultValue={transaction?.categoryId ?? ""}
                  errors={errors.categoryId}
                />

                <DateField
                  name="date"
                  label="Date"
                  required
                  defaultValue={transaction?.date ?? new Date().toISOString().slice(0, 10)}
                  errors={errors.date}
                />
                <TextField
                  name="amount"
                  label={`Amount (${currency})`}
                  required
                  hint="Positive number — direction comes from the type."
                  defaultValue={transaction?.amount ?? ""}
                  errors={errors.amount}
                />
                <SelectField
                  name="paymentMethod"
                  label="Payment method"
                  required
                  options={PAYMENT_METHODS.map((m) => ({
                    value: m,
                    label: m.replace(/_/g, " ").toLowerCase(),
                  }))}
                  defaultValue={transaction?.paymentMethod ?? "CASH"}
                  errors={errors.paymentMethod}
                />
                <SelectField
                  name="requesterId"
                  label="Requested for"
                  placeholder="Nobody in particular"
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.fullName} · ${e.employeeNo}`,
                  }))}
                  defaultValue={transaction?.requesterId ?? ""}
                  errors={errors.requesterId}
                />
              </div>

              <TextField
                name="description"
                label="Description"
                required
                defaultValue={transaction?.description ?? ""}
                errors={errors.description}
              />
              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={transaction?.notes ?? ""}
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
                {pending ? "Saving…" : transaction ? "Save changes" : "Raise transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
