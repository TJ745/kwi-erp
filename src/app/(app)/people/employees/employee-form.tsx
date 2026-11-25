"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DateField,
  FieldSet,
  SelectField,
  TextAreaField,
  TextField,
  type SelectOption,
} from "@/components/forms/field";
import { EntitySelect } from "@/components/forms/entity-select";
import { readString } from "@/lib/form-data";
import { EMPLOYEE_STATUSES } from "@/lib/schemas/employee";
import {
  CONTRACT_YEARS,
  COVERS,
  FAMILY_STATUSES,
  LEAVE_PLANS,
  PROBATION_DAYS,
  TERM_OPTION_LABELS,
} from "@/lib/job-offer";
import {
  createEmployeeAction,
  managerOptionsAction,
  updateEmployeeAction,
} from "@/server/actions/employees";

type Options = {
  companies: { id: string; code: string; name: string }[];
  departments: { id: string; name: string; companyId: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  managers: { id: string; fullName: string; employeeNo: string }[];
};

export type EmployeeFormValues = {
  id?: string;
  employeeNo?: string;
  companyId?: string;
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  firstName?: string;
  middleName?: string;
  familyName?: string;
  lastName?: string;
  fullNameAr?: string | null;
  gender?: string;
  dateOfBirth?: Date | null;
  nationality?: string;
  maritalStatus?: string | null;
  status?: string;
  employmentType?: string;
  joiningDate?: Date | null;
  lastWorkingDate?: Date | null;
  mobile?: string | null;
  workEmail?: string | null;
  personalEmail?: string | null;
  notes?: string | null;
  saudiAddressEn?: string | null;
  saudiAddressAr?: string | null;
  homeAddressEn?: string | null;
  homeAddressAr?: string | null;
  homePhone?: string | null;
  contractYears?: number | null;
  probationDays?: number | null;
  familyStatus?: string | null;
  leavePlan?: string | null;
  ticketDestination?: string | null;
  ticketCover?: string | null;
  medicalCover?: string | null;
};

const PROFILE_TEXT = [
  "saudiAddressEn",
  "saudiAddressAr",
  "homeAddressEn",
  "homeAddressAr",
  "homePhone",
  "contractYears",
  "probationDays",
  "familyStatus",
  "leavePlan",
  "ticketDestination",
  "ticketCover",
  "medicalCover",
] as const;

const labelled = <T extends string | number>(values: readonly T[], labels: Record<T, string>) =>
  values.map((v) => ({ value: String(v), label: labels[v] }));

const toOptions = (items: { id: string; label: string }[]): SelectOption[] =>
  items.map((i) => ({ value: i.id, label: i.label }));

const NONE: SelectOption = { value: "none", label: "— None —" };

export function EmployeeForm({
  mode,
  options,
  values = {},
}: {
  mode: "create" | "edit";
  options: Options;
  values?: EmployeeFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState(
    values.companyId ?? options.companies[0]?.id ?? "",
  );

  // Departments and positions belong to a company; showing another company's
  // would produce a cross-company reference the service rejects anyway.
  const departments = options.departments.filter((d) => d.companyId === companyId);
  const positions = options.positions.filter(
    (p) => p.companyId === null || p.companyId === companyId,
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const fd = new FormData(event.currentTarget);
    const payload = {
      employeeNo: readString(fd, "employeeNo"),
      companyId: readString(fd, "companyId"),
      departmentId: readString(fd, "departmentId"),
      positionId: readString(fd, "positionId"),
      managerId: readString(fd, "managerId"),
      firstName: readString(fd, "firstName"),
      middleName: readString(fd, "middleName"),
      familyName: readString(fd, "familyName"),
      lastName: readString(fd, "lastName"),
      fullNameAr: readString(fd, "fullNameAr"),
      gender: readString(fd, "gender"),
      dateOfBirth: readString(fd, "dateOfBirth"),
      nationality: readString(fd, "nationality"),
      maritalStatus: readString(fd, "maritalStatus"),
      status: readString(fd, "status"),
      employmentType: readString(fd, "employmentType"),
      joiningDate: readString(fd, "joiningDate"),
      lastWorkingDate: readString(fd, "lastWorkingDate"),
      mobile: readString(fd, "mobile"),
      workEmail: readString(fd, "workEmail"),
      personalEmail: readString(fd, "personalEmail"),
      notes: readString(fd, "notes"),
      ...Object.fromEntries(PROFILE_TEXT.map((k) => [k, readString(fd, k)])),
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createEmployeeAction(payload)
          : await updateEmployeeAction({ ...payload, id: values.id ?? "" });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        else toast.error("Please correct the highlighted fields.");
        return;
      }

      toast.success(mode === "create" ? "Employee created." : "Employee updated.");
      const id = "id" in result.data ? result.data.id : values.id;
      router.push(`/people/employees/${String(id)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
        >
          {formError}
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-6">
          <FieldSet legend="Identity">
            <TextField
              name="employeeNo"
              label="Employee ID"
              required
              hint="The company's own staff number, e.g. KWI-014. It must be unique."
              defaultValue={values.employeeNo ?? ""}
              errors={errors.employeeNo}
            />
            <TextField
              name="firstName"
              label="First name"
              required
              defaultValue={values.firstName ?? ""}
              errors={errors.firstName}
            />
            <TextField
              name="middleName"
              label="Middle name"
              hint="Father's name, as printed on the Iqama."
              defaultValue={values.middleName ?? ""}
              errors={errors.middleName}
            />
            <TextField
              name="lastName"
              label="Last name"
              required
              hint="Grandfather's name."
              defaultValue={values.lastName ?? ""}
              errors={errors.lastName}
            />
            <TextField
              name="familyName"
              label="Family name"
              defaultValue={values.familyName ?? ""}
              errors={errors.familyName}
            />
            <TextField
              name="fullNameAr"
              label="Full name (Arabic)"
              hint="Stored for official letters."
              defaultValue={values.fullNameAr ?? ""}
              errors={errors.fullNameAr}
            />
            <SelectField
              name="gender"
              label="Gender"
              required
              defaultValue={values.gender ?? "MALE"}
              options={[
                { value: "MALE", label: "Male" },
                { value: "FEMALE", label: "Female" },
              ]}
              errors={errors.gender}
            />
            <DateField
              name="dateOfBirth"
              label="Date of birth"
              defaultValue={values.dateOfBirth ?? ""}
              errors={errors.dateOfBirth}
            />
            <TextField
              name="nationality"
              label="Nationality"
              required
              hint="Two-letter country code, e.g. SA, PK, IN."
              defaultValue={values.nationality ?? "SA"}
              errors={errors.nationality}
            />
            <SelectField
              name="maritalStatus"
              label="Marital status"
              defaultValue={values.maritalStatus ?? ""}
              options={[
                { value: "SINGLE", label: "Single" },
                { value: "MARRIED", label: "Married" },
                { value: "DIVORCED", label: "Divorced" },
                { value: "WIDOWED", label: "Widowed" },
              ]}
              errors={errors.maritalStatus}
            />
          </FieldSet>

          <FieldSet legend="Employment">
            <div className="space-y-1.5">
              <label htmlFor="field-companyId" className="text-sm font-medium">
                Company <span className="text-destructive">*</span>
              </label>
              <input type="hidden" name="companyId" value={companyId} />
              <select
                id="field-companyId"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                }}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                {options.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              {errors.companyId ? (
                <p className="text-destructive text-xs">{errors.companyId[0]}</p>
              ) : null}
            </div>

            <SelectField
              name="departmentId"
              label="Department"
              defaultValue={values.departmentId ?? "none"}
              options={[NONE, ...toOptions(departments.map((d) => ({ id: d.id, label: d.name })))]}
              errors={errors.departmentId}
            />
            <SelectField
              name="positionId"
              label="Position"
              defaultValue={values.positionId ?? "none"}
              options={[NONE, ...toOptions(positions.map((p) => ({ id: p.id, label: p.title })))]}
              errors={errors.positionId}
            />
            {/*
              Searched server-side rather than preloaded. The candidate list is
              every active employee of every company the user can see — people
              report across the group's companies.
            */}
            <EntitySelect
              name="managerId"
              label="Reports to"
              placeholder="Search by name or number…"
              emptyLabel="No matching employee"
              clearLabel="— No manager —"
              hint="Active employees of any company."
              defaultValue={values.managerId ?? undefined}
              defaultLabel={
                options.managers.find((m) => m.id === values.managerId)?.fullName ?? undefined
              }
              errors={errors.managerId}
              search={async (query) => {
                const result = await managerOptionsAction({
                  companyId,
                  // Never offer the employee themselves: the service refuses
                  // a self-reporting loop anyway.
                  ...(values.id ? { excludeId: values.id } : {}),
                  ...(query ? { q: query } : {}),
                });
                if (!result.success) return [];
                return result.data.map((m) => ({
                  value: m.id,
                  label: m.fullName,
                  hint: `${m.employeeNo} · ${m.companyCode}`,
                }));
              }}
            />
            <SelectField
              name="employmentType"
              label="Employment type"
              defaultValue={values.employmentType ?? "FULL_TIME"}
              options={[
                { value: "FULL_TIME", label: "Full time" },
                { value: "PART_TIME", label: "Part time" },
                { value: "CONTRACT", label: "Contract" },
                { value: "TEMPORARY", label: "Temporary" },
                { value: "INTERN", label: "Intern" },
              ]}
              errors={errors.employmentType}
            />
            <SelectField
              name="status"
              label="Status"
              defaultValue={values.status ?? "ACTIVE"}
              hint="New hire: added before joining. Not counted as staff until Active."
              options={EMPLOYEE_STATUSES.map((s) => ({
                value: s,
                label: s
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/^./, (c) => c.toUpperCase()),
              }))}
              errors={errors.status}
            />
            <DateField
              name="joiningDate"
              label="Joining date"
              required
              defaultValue={values.joiningDate ?? ""}
              errors={errors.joiningDate}
            />
            <DateField
              name="lastWorkingDate"
              label="Last working date"
              hint="Required when the employee leaves."
              defaultValue={values.lastWorkingDate ?? ""}
              errors={errors.lastWorkingDate}
            />
          </FieldSet>

          <FieldSet legend="Contact">
            <TextField
              name="mobile"
              label="Mobile"
              defaultValue={values.mobile ?? ""}
              errors={errors.mobile}
            />
            <TextField
              name="workEmail"
              label="Work email"
              type="email"
              defaultValue={values.workEmail ?? ""}
              errors={errors.workEmail}
            />
            <TextField
              name="personalEmail"
              label="Personal email"
              type="email"
              defaultValue={values.personalEmail ?? ""}
              errors={errors.personalEmail}
            />
          </FieldSet>

          <FieldSet legend="Addresses">
            <TextAreaField
              name="saudiAddressEn"
              label="Address in KSA (English)"
              rows={2}
              defaultValue={values.saudiAddressEn ?? ""}
              errors={errors.saudiAddressEn}
            />
            <TextAreaField
              name="saudiAddressAr"
              label="Address in KSA (Arabic)"
              rows={2}
              defaultValue={values.saudiAddressAr ?? ""}
              errors={errors.saudiAddressAr}
            />
            <TextAreaField
              name="homeAddressEn"
              label="Home country address (English)"
              rows={2}
              defaultValue={values.homeAddressEn ?? ""}
              errors={errors.homeAddressEn}
            />
            <TextAreaField
              name="homeAddressAr"
              label="Home country address (Arabic)"
              rows={2}
              defaultValue={values.homeAddressAr ?? ""}
              errors={errors.homeAddressAr}
            />
            <TextField
              name="homePhone"
              label="Home country phone"
              defaultValue={values.homePhone ?? ""}
              errors={errors.homePhone}
            />
          </FieldSet>

          <FieldSet legend="Terms of employment">
            <SelectField
              name="contractYears"
              label="Contract duration"
              placeholder="—"
              defaultValue={values.contractYears ? String(values.contractYears) : ""}
              options={labelled(CONTRACT_YEARS, TERM_OPTION_LABELS.contractYears)}
              errors={errors.contractYears}
            />
            <SelectField
              name="probationDays"
              label="Probation"
              placeholder="—"
              defaultValue={values.probationDays ? String(values.probationDays) : ""}
              options={labelled(PROBATION_DAYS, TERM_OPTION_LABELS.probationDays)}
              errors={errors.probationDays}
            />
            <SelectField
              name="familyStatus"
              label="Family status"
              placeholder="—"
              defaultValue={values.familyStatus ?? ""}
              options={labelled(FAMILY_STATUSES, TERM_OPTION_LABELS.familyStatus)}
              errors={errors.familyStatus}
            />
            <SelectField
              name="leavePlan"
              label="Leave entitlement"
              placeholder="—"
              defaultValue={values.leavePlan ?? ""}
              options={labelled(LEAVE_PLANS, TERM_OPTION_LABELS.leavePlan)}
              errors={errors.leavePlan}
            />
            <TextField
              name="ticketDestination"
              label="Ticket destination"
              hint="Airport or city for the leave ticket."
              defaultValue={values.ticketDestination ?? ""}
              errors={errors.ticketDestination}
            />
            <SelectField
              name="ticketCover"
              label="Ticket cover"
              placeholder="—"
              defaultValue={values.ticketCover ?? ""}
              options={labelled(COVERS, TERM_OPTION_LABELS.cover)}
              errors={errors.ticketCover}
            />
            <SelectField
              name="medicalCover"
              label="Medical cover"
              placeholder="—"
              defaultValue={values.medicalCover ?? ""}
              options={labelled(COVERS, TERM_OPTION_LABELS.cover)}
              errors={errors.medicalCover}
            />
          </FieldSet>

          <TextAreaField
            name="notes"
            label="Notes"
            defaultValue={values.notes ?? ""}
            errors={errors.notes}
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.back();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create employee" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
