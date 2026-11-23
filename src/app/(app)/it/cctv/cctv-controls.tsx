"use client";

import { CCTV_TYPES } from "@/lib/schemas/infrastructure";
import {
  createCctvAction,
  deleteCctvAction,
  updateCctvAction,
} from "@/server/actions/infrastructure";
import { RecordActions } from "@/components/shared/record-actions";
import {
  RecordDialog,
  type FieldSpec,
  type RecordValues,
} from "@/components/shared/record-dialog";

export type CctvAssetOption = {
  id: string;
  kind: "camera" | "recorder";
  label: string;
  usedByCctvId: string | null;
};

const DESCRIPTION =
  "Pick the device from Assets — its name, model, location, IP, and status come from there. A camera is an asset of type CCTV Camera; an NVR or DVR is a CCTV Recorder.";

/** Free camera/recorder assets, plus the one this entry already uses. */
function fields(
  assets: CctvAssetOption[],
  recorders: { id: string; label: string }[],
  cctvId?: string,
): FieldSpec[] {
  const available = assets.filter((a) => a.usedByCctvId === null || a.usedByCctvId === cctvId);
  return [
    {
      kind: "select",
      name: "assetId",
      label: "Device",
      required: true,
      placeholder: available.length === 0 ? "No free CCTV assets" : "Select from Assets",
      hint: "Only CCTV Camera and CCTV Recorder assets not already listed here.",
      options: available.map((a) => ({
        value: a.id,
        label: `${a.label} (${a.kind})`,
      })),
    },
    {
      kind: "select",
      name: "type",
      label: "CCTV type",
      required: true,
      options: CCTV_TYPES.map((t) => ({ value: t, label: t })),
    },
    {
      kind: "select",
      name: "recorderId",
      label: "Records to",
      placeholder: "Not attached",
      hint: "Cameras only.",
      // A device cannot record to itself.
      options: recorders.filter((r) => r.id !== cctvId).map((r) => ({ value: r.id, label: r.label })),
    },
    { kind: "date", name: "lastMaintenanceAt", label: "Last maintained" },
    { kind: "textarea", name: "notes", label: "Notes" },
  ];
}

function submit(data: Record<string, string | boolean>, id: string | undefined) {
  const payload = {
    assetId: String(data.assetId ?? ""),
    type: String(data.type ?? "DOME"),
    recorderId: String(data.recorderId ?? ""),
    lastMaintenanceAt: String(data.lastMaintenanceAt ?? ""),
    notes: String(data.notes ?? ""),
  };
  return id ? updateCctvAction({ ...payload, id }) : createCctvAction(payload);
}

export function CctvControls({
  assets,
  recorders,
  mode,
  values,
}: {
  assets: CctvAssetOption[];
  recorders: { id: string; label: string }[];
  mode: "create" | "row";
  values?: RecordValues;
}) {
  if (mode === "create") {
    return (
      <RecordDialog
        title="CCTV device"
        description={DESCRIPTION}
        triggerLabel="Add device"
        fields={fields(assets, recorders)}
        submit={submit}
      />
    );
  }

  const cctvId = typeof values?.id === "string" ? values.id : undefined;
  return (
    <RecordActions
      title="CCTV device"
      description={DESCRIPTION}
      fields={fields(assets, recorders, cctvId)}
      values={values ?? {}}
      submit={submit}
      remove={(id) => deleteCctvAction({ id })}
      label={typeof values?.assetCode === "string" ? values.assetCode : "device"}
    />
  );
}
