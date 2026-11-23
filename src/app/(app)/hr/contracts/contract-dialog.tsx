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
import { CONTRACT_STATUSES, CONTRACT_TYPES, type ContractParticulars } from "@/lib/schemas/hr";
import { HOURS_PER_DAY, MAX_CHILDREN, TERM_YEARS, WORK_DAYS } from "@/lib/employment-contract";
import {
  contractDefaultsAction,
  createContractAction,
  updateContractAction,
} from "@/server/actions/hr";

const titleCase = (v: string) =>
  v
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

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
  contractDate: string | null;
  positionTitle: string | null;
  jobDescriptionId: string | null;
  termYears: number;
  workDaysPerWeek: number;
  hoursPerDay: number;
  particulars: ContractParticulars | null;
};

/** What a new contract starts from (employee record and job offer). */
export type ContractDefaults = {
  positionTitle: string;
  termYears: number;
  salary: {
    basicSalary: string;
    housingAllowance: string;
    transportAllowance: string;
    otherAllowance: string;
  } | null;
  particulars: ContractParticulars;
};

type TextParticular = Exclude<keyof ContractParticulars, "ticketWife" | "ticketChildren">;

const PARTICULAR_FIELDS: { key: TextParticular; label: string; wide?: boolean }[] = [
  { key: "nameEn", label: "Name (English, as on passport)" },
  { key: "nameAr", label: "Name (Arabic)" },
  { key: "nationalityEn", label: "Nationality (English), e.g. Jordanian" },
  { key: "nationalityAr", label: "Nationality (Arabic), e.g. الاردن" },
  { key: "iqamaNo", label: "Iqama No." },
  { key: "passportNo", label: "Passport No." },
  { key: "dateOfBirth", label: "Date of birth (dd/mm/yyyy)" },
  { key: "homePhone", label: "Tel / Mob in home country" },
  { key: "homeAddressEn", label: "Address in home country (English)", wide: true },
  { key: "homeAddressAr", label: "Address in home country (Arabic)", wide: true },
  { key: "saudiAddressEn", label: "Address in Saudi Arabia (English)", wide: true },
  { key: "saudiAddressAr", label: "Address in Saudi Arabia (Arabic)", wide: true },
];

type EmployeeOption = { id: string; fullName: string; employeeNo: string; companyId: string };

/**
 * Contracts are made on the Contracts page: pick the employee, and the form
 * fills from their record and job offer. Editing opens the same form.
 */
export function ContractDialog({
  canSeeSalary,
  contract,
  employees = [],
  jobDescriptions = [],
}: {
  canSeeSalary: boolean;
  /** Absent for create. */
  contract?: (ContractFormValues & { employeeId: string; companyId: string }) | undefined;
  /** The employees a new contract can be for. */
  employees?: EmployeeOption[];
  jobDescriptions?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const mode = contract ? "edit" : "create";
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  // Create: the picked employee and what their record suggests.
  const [employee, setEmployee] = React.useState<EmployeeOption | null>(null);
  const [defaults, setDefaults] = React.useState<ContractDefaults | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);

  const employeeId = contract?.employeeId ?? employee?.id ?? "";
  const companyId = contract?.companyId ?? employee?.companyId ?? "";
  const startParticulars = contract?.particulars ?? defaults?.particulars;
  const [wife, setWife] = React.useState(startParticulars?.ticketWife ?? false);
  const showForm = mode === "edit" || (employee !== null && !loading);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !contract) {
      setEmployee(null);
      setDefaults(undefined);
      setErrors({});
      setFormError(null);
    }
  }

  function pickEmployee(id: string) {
    const picked = employees.find((e) => e.id === id) ?? null;
    setEmployee(picked);
    setDefaults(undefined);
    if (!picked) return;
    setLoading(true);
    void contractDefaultsAction({ employeeId: picked.id }).then((result) => {
      setLoading(false);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setDefaults(result.data);
      setWife(result.data.particulars.ticketWife);
    });
  }

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
      contractDate: readString(fd, "contractDate"),
      positionTitle: readString(fd, "positionTitle"),
      jobDescriptionId: readString(fd, "jobDescriptionId"),
      termYears: readString(fd, "termYears"),
      workDaysPerWeek: readString(fd, "workDaysPerWeek"),
      hoursPerDay: readString(fd, "hoursPerDay"),
      particulars: {
        ...Object.fromEntries(PARTICULAR_FIELDS.map((f) => [f.key, readString(fd, "p_" + f.key)])),
        ticketDestinationEn: readString(fd, "p_ticketDestinationEn"),
        ticketDestinationAr: readString(fd, "p_ticketDestinationAr"),
        ticketWife: wife,
        ticketChildren: readString(fd, "p_ticketChildren") || "0",
      },
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
          onOpenChange(true);
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

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add contract" : "Edit contract"}</DialogTitle>
            <DialogDescription>
              A fixed-term contract must have an end date. Dated active contracts appear in expiry
              alerts automatically.
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

            {mode === "create" ? (
              <SelectField
                name="employeePick"
                label="Employee"
                required
                options={employees.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} · ${e.employeeNo}`,
                }))}
                onChange={pickEmployee}
                errors={errors.employeeId}
                {...(loading ? { hint: "Loading the employee's details…" } : {})}
              />
            ) : null}

            {showForm ? (
              <div key={employeeId} className="space-y-4">
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
                        defaultValue={contract?.basicSalary ?? defaults?.salary?.basicSalary ?? ""}
                        errors={errors.basicSalary}
                      />
                      <TextField
                        name="housingAllowance"
                        label="Housing allowance"
                        defaultValue={
                          contract?.housingAllowance ?? defaults?.salary?.housingAllowance ?? ""
                        }
                        errors={errors.housingAllowance}
                      />
                      <TextField
                        name="transportAllowance"
                        label="Transport allowance"
                        defaultValue={
                          contract?.transportAllowance ?? defaults?.salary?.transportAllowance ?? ""
                        }
                        errors={errors.transportAllowance}
                      />
                      <TextField
                        name="otherAllowance"
                        label="Phone allowance"
                        defaultValue={
                          contract?.otherAllowance ?? defaults?.salary?.otherAllowance ?? ""
                        }
                        errors={errors.otherAllowance}
                      />
                    </div>
                  </fieldset>
                ) : null}

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold">Printed contract</legend>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <DateField
                      name="contractDate"
                      label="Contract date"
                      hint="Blank uses the start date."
                      defaultValue={contract?.contractDate ?? ""}
                      errors={errors.contractDate}
                    />
                    <TextField
                      name="positionTitle"
                      label="Position (as printed)"
                      defaultValue={contract?.positionTitle ?? defaults?.positionTitle ?? ""}
                      errors={errors.positionTitle}
                    />
                    <SelectField
                      name="termYears"
                      label="Contract term"
                      defaultValue={String(contract?.termYears ?? defaults?.termYears ?? 1)}
                      options={TERM_YEARS.map((y) => ({
                        value: String(y),
                        label: y === 1 ? "1 year" : "2 years",
                      }))}
                      errors={errors.termYears}
                    />
                    <SelectField
                      name="workDaysPerWeek"
                      label="Working days / week"
                      defaultValue={String(contract?.workDaysPerWeek ?? 5)}
                      options={WORK_DAYS.map((d) => ({
                        value: String(d),
                        label: d === 6 ? "6 days (Friday off)" : "5 days (Friday & Saturday off)",
                      }))}
                      errors={errors.workDaysPerWeek}
                    />
                    <SelectField
                      name="hoursPerDay"
                      label="Hours / day"
                      defaultValue={String(contract?.hoursPerDay ?? 8)}
                      options={HOURS_PER_DAY.map((h) => ({
                        value: String(h),
                        label: String(h) + " hours",
                      }))}
                      errors={errors.hoursPerDay}
                    />
                    <SelectField
                      name="jobDescriptionId"
                      label="Job description (Annexure 7)"
                      placeholder="None"
                      defaultValue={contract?.jobDescriptionId ?? ""}
                      options={jobDescriptions.map((j) => ({ value: j.id, label: j.title }))}
                      errors={errors.jobDescriptionId}
                    />
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold">
                    Employee particulars (as printed)
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {PARTICULAR_FIELDS.map((f) => (
                      <TextField
                        key={f.key}
                        name={"p_" + f.key}
                        label={f.label}
                        defaultValue={startParticulars?.[f.key] ?? ""}
                        errors={errors["particulars." + f.key]}
                        className={f.wide ? "sm:col-span-2" : undefined}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold">
                    Air tickets (articles 13 and 23)
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      name="p_ticketDestinationEn"
                      label="From Riyadh to (English)"
                      placeholder="Amman"
                      defaultValue={startParticulars?.ticketDestinationEn ?? ""}
                      errors={errors["particulars.ticketDestinationEn"]}
                    />
                    <TextField
                      name="p_ticketDestinationAr"
                      label="From Riyadh to (Arabic)"
                      placeholder="عمان"
                      defaultValue={startParticulars?.ticketDestinationAr ?? ""}
                      errors={errors["particulars.ticketDestinationAr"]}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={wife}
                        onChange={(e) => {
                          setWife(e.target.checked);
                        }}
                      />
                      Includes his wife
                    </label>
                    <SelectField
                      name="p_ticketChildren"
                      label="Children (up to 18 years)"
                      defaultValue={String(startParticulars?.ticketChildren ?? 0)}
                      options={Array.from({ length: MAX_CHILDREN + 1 }, (_, n) => ({
                        value: String(n),
                        label: n === 0 ? "None" : String(n),
                      }))}
                      errors={errors["particulars.ticketChildren"]}
                    />
                  </div>
                </fieldset>

                <TextAreaField
                  name="notes"
                  label="Notes"
                  defaultValue={contract?.notes ?? ""}
                  errors={errors.notes}
                />
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
              <Button type="submit" disabled={pending || !showForm}>
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
