"use server";

import { meterIdSchema, meterSchema, updateMeterSchema } from "@/lib/schemas/meters";
import { defineAction } from "./define-action";
import { createMeter, deleteMeter, updateMeter } from "@/server/services/meters";

const METER_PATHS = ["/admin/utility-bills"];

export const createMeterAction = defineAction({
  permission: "meters.manage",
  schema: meterSchema,
  audit: { action: "CREATE", entity: "UTILITY_METER" },
  handler: async ({ input, audit }) => {
    const m = await createMeter(input);
    audit.record({
      entityId: m.id,
      summary: `Added meter ${m.meterNumber} — ${m.location}`,
      after: { meterNumber: m.meterNumber, location: m.location },
    });
    return { id: m.id };
  },
  revalidate: () => METER_PATHS,
});

export const updateMeterAction = defineAction({
  permission: "meters.manage",
  schema: updateMeterSchema,
  audit: { action: "UPDATE", entity: "UTILITY_METER" },
  handler: async ({ input, audit }) => {
    const { before, after } = await updateMeter(input);
    audit.record({
      entityId: after.id,
      summary: `Updated meter ${after.meterNumber}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => METER_PATHS,
});

export const deleteMeterAction = defineAction({
  permission: "meters.manage",
  schema: meterIdSchema,
  audit: { action: "DELETE", entity: "UTILITY_METER" },
  handler: async ({ input, audit }) => {
    const m = await deleteMeter(input.id);
    audit.record({ entityId: m.id, summary: `Removed meter ${m.meterNumber} — ${m.location}` });
    return { id: m.id };
  },
  revalidate: () => METER_PATHS,
});
