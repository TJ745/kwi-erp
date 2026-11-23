"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CONTRACT_STATUSES,
  MAX_RATE_LINES,
  RATE_UNIT_LABELS,
  RATE_UNITS,
  type RateUnit,
} from "@/lib/schemas/vendors";
import {
  createSubcontractorContractAction,
  updateSubcontractorContractAction,
} from "@/server/actions/vendors";

export type ContractRate = { category: string; rate: string; unit: string };

export type ContractValues = {
  id: string;
  subcontractorId: string;
  companyId: string;
  contractNo: string;
  scope: string | null;
  startDate: string;
  endDate: string;
  agreementDate: string | null;
  value: string | null;
  currency: string;
  status: string;
  notes: string | null;
  terms: string | null;
  rates: ContractRate[];
};

type RateRow = ContractRate & { key: number };

let nextKey = 0;
const newRow = (rate?: ContractRate): RateRow => ({
  key: nextKey++,
  category: rate?.category ?? "",
  rate: rate?.rate ?? "",
  unit: rate?.unit ?? "HOUR",
});

export function ContractDialog({
  subcontractorId,
  companies,
  contract,
  defaultTerms = "",
  open: controlledOpen,
  onOpenChange,
}: {
  subcontractorId: string;
  companies: { id: string; code: string; name: string }[];
  contract?: ContractValues | undefined;
  /** The shared terms a NEW contract starts from. */
  defaultTerms?: string | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const initialRows = React.useCallback(
    () => (contract ? contract.rates.map((r) => newRow(r)) : [newRow()]),
    [contract],
  );
  const [rows, setRows] = React.useState<RateRow[]>(initialRows);

  const setOpen = React.useCallback(
    (next: boolean) => {
      // Each opening starts from the saved schedule, not from abandoned edits.
      if (next) setRows(initialRows());
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange, initialRows],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function updateRow(key: number, patch: Partial<ContractRate>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

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
      agreementDate: readString(fd, "agreementDate"),
      startDate: readString(fd, "startDate"),
      endDate: readString(fd, "endDate"),
      value: readString(fd, "value"),
      currency: readString(fd, "currency") || "SAR",
      status: readString(fd, "status"),
      notes: readString(fd, "notes"),
      terms: readString(fd, "terms"),
      // A row left completely empty is simply not a rate.
      rates: rows
        .filter((r) => r.category.trim() !== "" || r.rate.trim() !== "")
        .map((r) => ({ category: r.category, rate: r.rate, unit: r.unit as RateUnit })),
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

  const rateErrors = Object.entries(errors)
    .filter(([key]) => key === "rates" || key.startsWith("rates."))
    .flatMap(([, messages]) => messages);

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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{contract ? "Edit contract" : "Add contract"}</DialogTitle>
              <DialogDescription>
                The details below print as the sub-contract agreement on the company&apos;s
                letterhead. An active contract&apos;s end date also feeds the expiry register.
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
                  label="Company (first party)"
                  required
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  defaultValue={contract?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <DateField
                  name="agreementDate"
                  label="Agreement date"
                  hint="Printed at the top. Leave blank to use today."
                  defaultValue={contract?.agreementDate ?? ""}
                  errors={errors.agreementDate}
                />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))}
                  defaultValue={contract?.status ?? "ACTIVE"}
                  errors={errors.status}
                />
                <DateField
                  name="startDate"
                  label="Start date"
                  hint={'Printed as "Agreed on".'}
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
                  hint="Optional. Numbers only."
                  defaultValue={contract?.value ?? ""}
                  errors={errors.value}
                />
                <TextField
                  name="currency"
                  label="Currency"
                  defaultValue={contract?.currency ?? "SAR"}
                  errors={errors.currency}
                />
              </div>

              <TextAreaField
                name="scope"
                label="Scope of work"
                hint={'e.g. "Supply of Manpower as per hourly wages".'}
                rows={2}
                defaultValue={contract?.scope ?? ""}
                errors={errors.scope}
              />

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Rates</legend>
                {rows.length > 0 ? (
                  <div className="text-muted-foreground hidden grid-cols-[1fr_7rem_8rem_2.25rem] gap-2 text-xs sm:grid">
                    <span>Category</span>
                    <span>Rate</span>
                    <span>Unit</span>
                    <span />
                  </div>
                ) : null}
                {rows.map((row, index) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_7rem_8rem_2.25rem]"
                  >
                    <Input
                      aria-label={`Rate ${String(index + 1)} category`}
                      placeholder="e.g. Finishing carpenter – All nationalities"
                      value={row.category}
                      aria-invalid={Boolean(errors[`rates.${String(index)}.category`])}
                      onChange={(e) => {
                        updateRow(row.key, { category: e.target.value });
                      }}
                      className="col-span-2 sm:col-span-1"
                    />
                    <Input
                      aria-label={`Rate ${String(index + 1)} amount`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={row.rate}
                      aria-invalid={Boolean(errors[`rates.${String(index)}.rate`])}
                      onChange={(e) => {
                        updateRow(row.key, { rate: e.target.value });
                      }}
                    />
                    <select
                      aria-label={`Rate ${String(index + 1)} unit`}
                      value={row.unit}
                      onChange={(e) => {
                        updateRow(row.key, { unit: e.target.value });
                      }}
                      className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm"
                    >
                      {RATE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {RATE_UNIT_LABELS[u].option}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove rate ${String(index + 1)}`}
                      onClick={() => {
                        setRows((current) => current.filter((r) => r.key !== row.key));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {rateErrors.length > 0 ? (
                  <p className="text-destructive text-xs">{rateErrors[0]}</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={rows.length >= MAX_RATE_LINES}
                  onClick={() => {
                    setRows((current) => [...current, newRow()]);
                  }}
                >
                  <Plus />
                  Add rate
                </Button>
              </fieldset>

              <TextAreaField
                name="terms"
                label="Terms & conditions"
                hint="One term per line. They print as a numbered list. Changing them here affects this contract only."
                rows={10}
                defaultValue={contract ? (contract.terms ?? "") : defaultTerms}
                errors={errors.terms}
              />

              <TextAreaField
                name="notes"
                label="Internal notes"
                hint="Not printed."
                rows={2}
                defaultValue={contract?.notes ?? ""}
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
                {pending ? "Saving…" : contract ? "Save changes" : "Add contract"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
