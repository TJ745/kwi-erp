"use client";

import {
  createAdRecordAction,
  deleteAdRecordAction,
  updateAdRecordAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import {
  RecordDialog,
  type FieldSpec,
  type RecordValues,
} from "../_components/record-dialog";

const DESCRIPTION =
  "Metadata only. There is no password field here and never will be — credentials belong in the vault.";

function fields(
  employees: { id: string; fullName: string; employeeNo: string }[],
): FieldSpec[] {
  return [
    {
      kind: "text",
      name: "samAccountName",
      label: "Account name",
      required: true,
      hint: "sAMAccountName, e.g. a.khan",
    },
    {
      kind: "select",
      name: "employeeId",
      label: "Employee",
      placeholder: "Unlinked",
      hint: "Linking is what surfaces accounts left enabled after someone leaves.",
      options: employees.map((e) => ({
        value: e.id,
        label: `${e.fullName} · ${e.employeeNo}`,
      })),
    },
    {
      kind: "text",
      name: "ou",
      label: "Organisational unit",
      wide: true,
      hint: "e.g. OU=Staff,DC=example,DC=local",
    },
    {
      kind: "textarea",
      name: "groups",
      label: "Groups",
      rows: 3,
      hint: "One per line, or comma separated.",
    },
    { kind: "checkbox", name: "enabled", label: "Account enabled" },
    { kind: "textarea", name: "notes", label: "Notes" },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    samAccountName: String(data.samAccountName ?? ""),
    employeeId: String(data.employeeId ?? ""),
    ou: String(data.ou ?? ""),
    groups: String(data.groups ?? ""),
    enabled: data.enabled === true,
    notes: String(data.notes ?? ""),
  };
  return id ? updateAdRecordAction({ ...payload, id }) : createAdRecordAction(payload);
}

export function AdControls({
  employees,
  mode,
  values,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="AD account"
        description={DESCRIPTION}
        triggerLabel="Record account"
        fields={fields(employees)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="AD account"
      description={DESCRIPTION}
      fields={fields(employees)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteAdRecordAction({ id })}
      label={
        typeof values?.samAccountName === "string" ? values.samAccountName : "account"
      }
    />
  );
}
