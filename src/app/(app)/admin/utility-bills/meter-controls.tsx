"use client";

import {
  createMeterAction,
  deleteMeterAction,
  updateMeterAction,
} from "@/server/actions/meters";
import { RecordActions } from "@/components/shared/record-actions";
import {
  RecordDialog,
  type FieldSpec,
  type RecordValues,
} from "@/components/shared/record-dialog";

const DESCRIPTION = "A utility meter, where it is, and what it is for. Each meter number can be recorded once.";

const FIELDS: FieldSpec[] = [
  { kind: "text", name: "meterNumber", label: "Meter number", required: true },
  { kind: "text", name: "location", label: "Location", required: true, hint: "Building, camp, or address" },
  {
    kind: "textarea",
    name: "description",
    label: "Description",
    hint: "e.g. Electricity — main supply, Water — staff housing",
  },
];

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    meterNumber: String(data.meterNumber ?? ""),
    location: String(data.location ?? ""),
    description: String(data.description ?? ""),
  };
  return id ? updateMeterAction({ ...payload, id }) : createMeterAction(payload);
}

export function MeterControls({
  mode,
  values,
}: {
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="Utility meter"
        description={DESCRIPTION}
        triggerLabel="Add meter"
        fields={FIELDS}
        submit={submit}
      />
    );
  }

  return (
    <RecordActions
      title="Utility meter"
      description={DESCRIPTION}
      fields={FIELDS}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteMeterAction({ id })}
      label={typeof values?.meterNumber === "string" ? `meter ${values.meterNumber}` : "meter"}
    />
  );
}
