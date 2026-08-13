"use client";

import { RECORD_STATUSES } from "@/lib/schemas/infrastructure";
import {
  createServerAction,
  deleteServerAction,
  updateServerAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import { RecordDialog, type FieldSpec, type RecordValues } from "../_components/record-dialog";

const DESCRIPTION = "Server names are unique across the estate.";

function fields(companies: { id: string; code: string; name: string }[]): FieldSpec[] {
  return [
    { kind: "text", name: "name", label: "Name", required: true },
    {
      kind: "select",
      name: "companyId",
      label: "Company",
      required: true,
      options: companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    },
    { kind: "text", name: "ipAddress", label: "IP address", hint: "IPv4 or IPv6." },
    { kind: "text", name: "role", label: "Role", hint: "e.g. domain controller, file server." },
    { kind: "text", name: "os", label: "Operating system" },
    { kind: "text", name: "location", label: "Location" },
    { kind: "text", name: "cpuSpec", label: "CPU" },
    { kind: "text", name: "ramGb", label: "RAM (GB)" },
    { kind: "text", name: "storageGb", label: "Storage (GB)" },
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

/** Maps the generic dialog's flat data onto the typed action. */
function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    companyId: String(data.companyId ?? ""),
    name: String(data.name ?? ""),
    ipAddress: String(data.ipAddress ?? ""),
    os: String(data.os ?? ""),
    role: String(data.role ?? ""),
    location: String(data.location ?? ""),
    cpuSpec: String(data.cpuSpec ?? ""),
    ramGb: String(data.ramGb ?? ""),
    storageGb: String(data.storageGb ?? ""),
    status: String(data.status ?? "ACTIVE"),
    notes: String(data.notes ?? ""),
  };
  return id ? updateServerAction({ ...payload, id }) : createServerAction(payload);
}

export function ServerControls({
  companies,
  mode,
  values,
}: {
  companies: { id: string; code: string; name: string }[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="server"
        description={DESCRIPTION}
        triggerLabel="Add server"
        fields={fields(companies)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="server"
      description={DESCRIPTION}
      fields={fields(companies)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteServerAction({ id })}
      label={typeof values?.name === "string" ? values.name : "server"}
    />
  );
}
