"use client";

import { CCTV_TYPES, RECORD_STATUSES } from "@/lib/schemas/infrastructure";
import {
  createCctvAction,
  deleteCctvAction,
  updateCctvAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import {
  RecordDialog,
  type FieldSpec,
  type RecordValues,
} from "../_components/record-dialog";

const DESCRIPTION =
  "Attach cameras to a recorder. A recorder cannot itself be attached to another one.";

function fields(
  companies: { id: string; code: string; name: string }[],
  recorders: { id: string; name: string }[],
): FieldSpec[] {
  return [
    { kind: "text", name: "name", label: "Name", required: true },
    {
      kind: "select",
      name: "type",
      label: "Type",
      required: true,
      options: CCTV_TYPES.map((t) => ({ value: t, label: t })),
    },
    { kind: "text", name: "location", label: "Location", required: true },
    {
      kind: "select",
      name: "companyId",
      label: "Company",
      required: true,
      options: companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    },
    { kind: "text", name: "ipAddress", label: "IP address" },
    {
      kind: "select",
      name: "recorderId",
      label: "Records to",
      placeholder: "Not attached",
      hint: "Cameras only.",
      options: recorders.map((r) => ({ value: r.id, label: r.name })),
    },
    { kind: "date", name: "lastMaintenanceAt", label: "Last maintained" },
    {
      kind: "select",
      name: "status",
      label: "Status",
      required: true,
      options: RECORD_STATUSES.map((s) => ({ value: s, label: s })),
    },
    { kind: "textarea", name: "notes", label: "Notes" },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    companyId: String(data.companyId ?? ""),
    name: String(data.name ?? ""),
    type: String(data.type ?? "DOME"),
    location: String(data.location ?? ""),
    ipAddress: String(data.ipAddress ?? ""),
    recorderId: String(data.recorderId ?? ""),
    status: String(data.status ?? "ACTIVE"),
    lastMaintenanceAt: String(data.lastMaintenanceAt ?? ""),
    notes: String(data.notes ?? ""),
  };
  return id ? updateCctvAction({ ...payload, id }) : createCctvAction(payload);
}

export function CctvControls({
  companies,
  recorders,
  mode,
  values,
}: {
  companies: { id: string; code: string; name: string }[];
  recorders: { id: string; name: string }[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="CCTV device"
        description={DESCRIPTION}
        triggerLabel="Add device"
        fields={fields(companies, recorders)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="CCTV device"
      description={DESCRIPTION}
      fields={fields(companies, recorders)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteCctvAction({ id })}
      label={typeof values?.name === "string" ? values.name : "device"}
    />
  );
}
