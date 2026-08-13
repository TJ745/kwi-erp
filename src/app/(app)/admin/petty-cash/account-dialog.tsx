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
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createAccountAction, updateAccountAction } from "@/server/actions/petty-cash";

export type AccountValues = {
  id: string;
  companyId: string;
  name: string;
  openingBalance: string;
  currency: string;
  custodianId: string | null;
  isActive: boolean;
};

export function AccountDialog({
  companies,
  account,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  account?: AccountValues | undefined;
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
  const [isActive, setIsActive] = React.useState(account?.isActive ?? true);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      name: readString(fd, "name"),
      openingBalance: readString(fd, "openingBalance") || "0",
      currency: readString(fd, "currency") || "SAR",
      custodianId: readString(fd, "custodianId"),
      isActive,
    };

    startTransition(async () => {
      const result = account
        ? await updateAccountAction({ ...values, id: account.id })
        : await createAccountAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(account ? "Account updated." : "Account opened.");
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
          Open account
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {account ? "Edit petty cash account" : "Open petty cash account"}
              </DialogTitle>
              <DialogDescription>
                The opening balance is the starting point every later balance is computed
                from — changing it shifts the whole ledger.
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
                name="name"
                label="Account name"
                required
                defaultValue={account?.name ?? ""}
                errors={errors.name}
              />
              <SelectField
                name="companyId"
                label="Company"
                required
                options={companies.map((c) => ({
                  value: c.id,
                  label: `${c.code} — ${c.name}`,
                }))}
                defaultValue={account?.companyId ?? companies[0]?.id ?? ""}
                errors={errors.companyId}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="openingBalance"
                  label="Opening balance"
                  hint="Numbers only."
                  defaultValue={account?.openingBalance ?? "0"}
                  errors={errors.openingBalance}
                />
                <TextField
                  name="currency"
                  label="Currency"
                  defaultValue={account?.currency ?? "SAR"}
                  errors={errors.currency}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    setIsActive(checked === true);
                  }}
                />
                <Label htmlFor="isActive" className="font-normal">
                  Active — a closed account takes no new transactions
                </Label>
              </div>
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
                {pending ? "Saving…" : account ? "Save changes" : "Open account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
