"use client";

import {
  createIpPhoneAction,
  deleteIpPhoneAction,
  updateIpPhoneAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "@/components/shared/record-actions";
import { RecordDialog, type FieldSpec, type RecordValues } from "@/components/shared/record-dialog";

export type HandsetOption = { id: string; label: string; usedByPhoneId: string | null };

const DESCRIPTION =
  "Pick the handset from Assets. Its model, MAC, location, status, and holder come from the asset record. Each handset carries one extension.";

/** Free handsets, plus the one this entry already uses when editing. */
function fields(handsets: HandsetOption[], phoneId?: string): FieldSpec[] {
  const available = handsets.filter((h) => h.usedByPhoneId === null || h.usedByPhoneId === phoneId);
  return [
    { kind: "text", name: "extension", label: "Extension", required: true, hint: "Digits only." },
    {
      kind: "select",
      name: "assetId",
      label: "Handset",
      required: true,
      placeholder: available.length === 0 ? "No free IP-phone assets" : "Select a handset",
      hint: "Only assets of type IP Phone that have no extension yet are listed.",
      options: available.map((h) => ({ value: h.id, label: h.label })),
    },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    extension: String(data.extension ?? ""),
    assetId: String(data.assetId ?? ""),
  };
  return id ? updateIpPhoneAction({ ...payload, id }) : createIpPhoneAction(payload);
}

export function PhoneControls({
  handsets,
  mode,
  values,
}: {
  handsets: HandsetOption[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="IP phone"
        description={DESCRIPTION}
        triggerLabel="Add extension"
        fields={fields(handsets)}
        submit={submit}
      />
    );
  }

  const phoneId = typeof values?.id === "string" ? values.id : undefined;
  return (
    <RecordActions
      title="IP phone"
      description={DESCRIPTION}
      fields={fields(handsets, phoneId)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteIpPhoneAction({ id })}
      label={typeof values?.extension === "string" ? `extension ${values.extension}` : "extension"}
    />
  );
}
