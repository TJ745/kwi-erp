"use client";

import {
  createLicenceAction,
  deleteLicenceAction,
  updateLicenceAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "../_components/record-actions";
import {
  RecordDialog,
  type FieldSpec,
  type RecordValues,
} from "../_components/record-dialog";

const DESCRIPTION =
  "There is no key field here by design. Store the key as a vault credential and link it — the vault is the only place it can be revealed.";

function fields(
  companies: { id: string; code: string; name: string }[],
  credentials: { id: string; name: string }[],
): FieldSpec[] {
  return [
    { kind: "text", name: "name", label: "Software", required: true },
    { kind: "text", name: "vendor", label: "Vendor" },
    {
      kind: "select",
      name: "companyId",
      label: "Company",
      required: true,
      options: companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    },
    {
      kind: "select",
      name: "licenseKeyCredentialId",
      label: "Licence key (vault credential)",
      placeholder: credentials.length > 0 ? "Not linked" : "No vault access",
      hint: "Links to a credential; the key is never shown here.",
      options: credentials.map((c) => ({ value: c.id, label: c.name })),
    },
    { kind: "text", name: "seats", label: "Seats owned", required: true },
    { kind: "text", name: "seatsUsed", label: "Seats deployed", required: true },
    { kind: "date", name: "purchaseDate", label: "Purchased" },
    {
      kind: "date",
      name: "expiryDate",
      label: "Expiry",
      hint: "Leave blank for a perpetual licence.",
    },
    { kind: "textarea", name: "notes", label: "Notes" },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    companyId: String(data.companyId ?? ""),
    name: String(data.name ?? ""),
    vendor: String(data.vendor ?? ""),
    licenseKeyCredentialId: String(data.licenseKeyCredentialId ?? ""),
    seats: String(data.seats ?? "1"),
    seatsUsed: String(data.seatsUsed ?? "0"),
    purchaseDate: String(data.purchaseDate ?? ""),
    expiryDate: String(data.expiryDate ?? ""),
    notes: String(data.notes ?? ""),
  };
  return id ? updateLicenceAction({ ...payload, id }) : createLicenceAction(payload);
}

export function LicenceControls({
  companies,
  credentials,
  mode,
  values,
}: {
  companies: { id: string; code: string; name: string }[];
  credentials: { id: string; name: string }[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="licence"
        description={DESCRIPTION}
        triggerLabel="Add licence"
        fields={fields(companies, credentials)}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="licence"
      description={DESCRIPTION}
      fields={fields(companies, credentials)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteLicenceAction({ id })}
      label={typeof values?.name === "string" ? values.name : "licence"}
    />
  );
}
