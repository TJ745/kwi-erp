"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
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
import { CONTRACT_STATUSES } from "@/lib/schemas/vendors";
import {
  createSubcontractorContractAction,
  updateSubcontractorContractAction,
} from "@/server/actions/vendors";

export type ContractValues = {
  id: string;
  subcontractorId: string;
  companyId: string;
  contractNo: string;
  scope: string | null;
  startDate: string;
  endDate: string;
  value: string | null;
  currency: string;
  status: string;
};

export function ContractDialog({
  subcontractorId,
  companies,
  contract,
  open: controlledOpen,
  onOpenChange,
}: {
  subcontractorId: string;
  companies: { id: string; code: string; name: string }[];
  contract?: ContractValues | undefined;
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      subcontractorId,
      companyId: readString(fd, "companyId"),
      contractNo: readString(fd, "contractNo"),
      scope: readString(fd, "scope"),
      startDate: readString(fd, "startDate"),
      endDate: readString(fd, "endDate"),
      value: readString(fd, "value"),
      currency: readString(fd, "currency") || "SAR",
      status: readString(fd, "status"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = contract
        ? await updateSubcontractorContractAction({ ...values, id: contract.id })
        : await createSubcontractorContractAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(contract ? "Contract updated." : "Contract added.");
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
          <FilePlus2 />
          Add contract
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{contract ? "Edit contract" : "Add contract"}</DialogTitle>
              <DialogDescription>
                An active contract&apos;s end date appears on the expiry register and
                triggers renewal reminders. Marking it expired or terminated stops those.
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
                  name="contractNo"
                  label="Contract number"
                  required
                  defaultValue={contract?.contractNo ?? ""}
                  errors={errors.contractNo}
                />
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  defaultValue={contract?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <DateField
                  name="startDate"
                  label="Start date"
                  required
                  defaultValue={contract?.startDate ?? ""}
                  errors={errors.startDate}
                />
                <DateField
                  name="endDate"
                  label="End date"
                  required
                  defaultValue={contract?.endDate ?? ""}
                  errors={errors.endDate}
                />
                <TextField
                  name="value"
                  label="Contract value"
                  hint="Numbers only."
                  defaultValue={contract?.value ?? ""}
                  errors={errors.value}
                />
                <TextField
                  name="currency"
                  label="Currency"
                  defaultValue={contract?.currency ?? "SAR"}
                  errors={errors.currency}
                />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))}
                  defaultValue={contract?.status ?? "ACTIVE"}
                  errors={errors.status}
                />
              </div>

              <TextAreaField
                name="scope"
                label="Scope of work"
                defaultValue={contract?.scope ?? ""}
                errors={errors.scope}
              />
              <TextAreaField name="notes" label="Notes" errors={errors.notes} />
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
                {pending ? "Saving…" : contract ? "Save changes" : "Add contract"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
