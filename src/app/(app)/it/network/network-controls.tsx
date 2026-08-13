"use client";

import { RECORD_STATUSES } from "@/lib/schemas/infrastructure";
import {
  createNetworkDeviceAction,
  deleteNetworkDeviceAction,
  updateNetworkDeviceAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import { RecordDialog, type FieldSpec, type RecordValues } from "../_components/record-dialog";

const DESCRIPTION =
  "MAC addresses are normalised on save, so the same device entered two ways collides rather than duplicating.";

function fields(companies: { id: string; code: string; name: string }[]): FieldSpec[] {
  return [
    { kind: "text", name: "name", label: "Name", required: true },
    { kind: "text", name: "type", label: "Type", required: true, hint: "Switch, router, firewall…" },
    {
      kind: "select",
      name: "companyId",
      label: "Company",
      required: true,
      options: companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    },
    { kind: "text", name: "model", label: "Model" },
    { kind: "text", name: "ipAddress", label: "Management IP" },
    { kind: "text", name: "macAddress", label: "MAC address" },
    { kind: "text", name: "vlan", label: "VLAN" },
    { kind: "text", name: "portCount", label: "Port count" },
    { kind: "text", name: "location", label: "Location" },
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
    type: String(data.type ?? ""),
    model: String(data.model ?? ""),
    ipAddress: String(data.ipAddress ?? ""),
    macAddress: String(data.macAddress ?? ""),
    location: String(data.location ?? ""),
    vlan: String(data.vlan ?? ""),
    portCount: String(data.portCount ?? ""),
    status: String(data.status ?? "ACTIVE"),
    notes: String(data.notes ?? ""),
  };
  return id
    ? updateNetworkDeviceAction({ ...payload, id })
    : createNetworkDeviceAction(payload);
}

export function NetworkControls({
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
        title="network device"
        description={DESCRIPTION}
        triggerLabel="Add device"
        fields={fields(companies)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="network device"
      description={DESCRIPTION}
      fields={fields(companies)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteNetworkDeviceAction({ id })}
      label={typeof values?.name === "string" ? values.name : "device"}
    />
  );
}
