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
import { CONTRACT_STATUSES, CONTRACT_TYPES } from "@/lib/schemas/hr";
import { createContractAction, updateContractAction } from "@/server/actions/hr";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export type ContractFormValues = {
  id: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  probationEndDate: string | null;
  status: string;
  currency: string;
  basicSalary: string | null;
  housingAllowance: string | null;
  transportAllowance: string | null;
  otherAllowance: string | null;
  notes: string | null;
};

export function ContractDialog({
  employeeId,
  companyId,
  canSeeSalary,
  contract,
}: {
  employeeId: string;
  companyId: string;
  canSeeSalary: boolean;
  /** Absent for create. */
  contract?: ContractFormValues;
}) {
  const router = useRouter();
  const mode = contract ? "edit" : "create";
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const payload = {
      employeeId,
      companyId,
      contractType: readString(fd, "contractType"),
      startDate: readString(fd, "startDate"),
      endDate: readString(fd, "endDate"),
      probationEndDate: readString(fd, "probationEndDate"),
      currency: readString(fd, "currency") || "SAR",
      status: readString(fd, "status") || "ACTIVE",
      notes: readString(fd, "notes"),
      // Salary fields are only submitted by someone who can see them;
      // otherwise they are omitted entirely rather than sent blank.
      ...(canSeeSalary
        ? {
            basicSalary: readString(fd, "basicSalary"),
            housingAllowance: readString(fd, "housingAllowance"),
            transportAllowance: readString(fd, "transportAllowance"),
            otherAllowance: readString(fd, "otherAllowance"),
          }
        : {}),
    };

    startTransition(async () => {
      const result = contract
        ? await updateContractAction({ ...payload, id: contract.id })
        : await createContractAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? "Contract created." : "Contract updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={mode === "create" ? "default" : "ghost"}
        onClick={() => {
          setOpen(true);
        }}
        aria-label={mode === "edit" ? "Edit contract" : undefined}
      >
        {mode === "create" ? (
          <>
            <Plus />
            Add contract
          </>
        ) : (
          <Pencil />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add contract" : "Edit contract"}</DialogTitle>
            <DialogDescription>
              A fixed-term contract must have an end date. Dated active contracts appear in
              expiry alerts automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
              >
                {formError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="contractType"
                label="Contract type"
                required
                defaultValue={contract?.contractType ?? "FIXED_TERM"}
                options={CONTRACT_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
                errors={errors.contractType}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={contract?.status ?? "ACTIVE"}
                options={CONTRACT_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
                errors={errors.status}
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
                hint="Required for fixed-term."
                defaultValue={contract?.endDate ?? ""}
                errors={errors.endDate}
              />
              <DateField
                name="probationEndDate"
                label="Probation ends"
                defaultValue={contract?.probationEndDate ?? ""}
                errors={errors.probationEndDate}
              />
              <TextField
                name="currency"
                label="Currency"
                defaultValue={contract?.currency ?? "SAR"}
                errors={errors.currency}
              />
            </div>

            {canSeeSalary ? (
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold">Remuneration</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name="basicSalary"
                    label="Basic salary"
                    hint="Numbers only, e.g. 7500.00"
                    defaultValue={contract?.basicSalary ?? ""}
                    errors={errors.basicSalary}
                  />
                  <TextField
                    name="housingAllowance"
                    label="Housing allowance"
                    defaultValue={contract?.housingAllowance ?? ""}
                    errors={errors.housingAllowance}
                  />
                  <TextField
                    name="transportAllowance"
                    label="Transport allowance"
                    defaultValue={contract?.transportAllowance ?? ""}
                    errors={errors.transportAllowance}
                  />
                  <TextField
                    name="otherAllowance"
                    label="Other allowance"
                    defaultValue={contract?.otherAllowance ?? ""}
                    errors={errors.otherAllowance}
                  />
                </div>
              </fieldset>
            ) : null}

            <TextAreaField
              name="notes"
              label="Notes"
              defaultValue={contract?.notes ?? ""}
              errors={errors.notes}
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
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
