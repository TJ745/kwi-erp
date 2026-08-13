"use client";

import { RECORD_STATUSES } from "@/lib/schemas/infrastructure";
import {
  createIpPhoneAction,
  deleteIpPhoneAction,
  updateIpPhoneAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import { RecordDialog, type FieldSpec, type RecordValues } from "../_components/record-dialog";

const DESCRIPTION = "Leave the employee blank for a handset sitting in pool stock.";

function fields(employees: { id: string; fullName: string; employeeNo: string }[]): FieldSpec[] {
  return [
    { kind: "text", name: "extension", label: "Extension", required: true, hint: "Digits only." },
    {
      kind: "select",
      name: "employeeId",
      label: "Assigned to",
      placeholder: "Pool stock",
      options: employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${e.employeeNo}` })),
    },
    { kind: "text", name: "deviceModel", label: "Handset model" },
    { kind: "text", name: "macAddress", label: "MAC address" },
    { kind: "text", name: "location", label: "Location" },
    {
      kind: "select",
      name: "status",
      label: "Status",
      required: true,
      options: RECORD_STATUSES.map((s) => ({ value: s, label: s })),
    },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    extension: String(data.extension ?? ""),
    employeeId: String(data.employeeId ?? ""),
    deviceModel: String(data.deviceModel ?? ""),
    macAddress: String(data.macAddress ?? ""),
    location: String(data.location ?? ""),
    status: String(data.status ?? "ACTIVE"),
  };
  return id ? updateIpPhoneAction({ ...payload, id }) : createIpPhoneAction(payload);
}

export function PhoneControls({
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
        title="handset"
        description={DESCRIPTION}
        triggerLabel="Add handset"
        fields={fields(employees)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="handset"
      description={DESCRIPTION}
      fields={fields(employees)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteIpPhoneAction({ id })}
      label={typeof values?.extension === "string" ? `extension ${values.extension}` : "handset"}
    />
  );
}
