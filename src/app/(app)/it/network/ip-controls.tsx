"use client";

import {
  createIpAddressAction,
  deleteIpAddressAction,
  updateIpAddressAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import { RecordDialog, type FieldSpec, type RecordValues } from "../_components/record-dialog";

const DESCRIPTION =
  "Addresses are unique across the whole estate. Two devices on one address is the classic outage nobody can explain.";

function fields(devices: { id: string; name: string }[]): FieldSpec[] {
  return [
    { kind: "text", name: "address", label: "IP address", required: true },
    { kind: "text", name: "subnet", label: "Subnet", hint: "e.g. 10.0.1.0/24" },
    { kind: "text", name: "assignedTo", label: "Assigned to", hint: "Person, service, or purpose." },
    {
      kind: "select",
      name: "deviceId",
      label: "Device",
      placeholder: "Not attached",
      options: devices.map((d) => ({ value: d.id, label: d.name })),
    },
    { kind: "checkbox", name: "isStatic", label: "Static allocation (not DHCP)" },
    { kind: "textarea", name: "notes", label: "Notes" },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    address: String(data.address ?? ""),
    subnet: String(data.subnet ?? ""),
    assignedTo: String(data.assignedTo ?? ""),
    deviceId: String(data.deviceId ?? ""),
    isStatic: data.isStatic === true,
    notes: String(data.notes ?? ""),
  };
  return id ? updateIpAddressAction({ ...payload, id }) : createIpAddressAction(payload);
}

export function IpControls({
  devices,
  mode,
  values,
}: {
  devices: { id: string; name: string }[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="IP address"
        description={DESCRIPTION}
        triggerLabel="Record IP"
        fields={fields(devices)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="IP address"
      description={DESCRIPTION}
      fields={fields(devices)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteIpAddressAction({ id })}
      label={typeof values?.address === "string" ? values.address : "address"}
    />
  );
}
