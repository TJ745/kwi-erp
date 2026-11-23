"use server";

import {
  cctvSchema,
  infrastructureIdSchema,
  ipPhoneSchema,
  updateCctvSchema,
  updateIpPhoneSchema,
} from "@/lib/schemas/infrastructure";
import { defineAction } from "./define-action";
import {
  createCctv,
  createIpPhone,
  deleteCctv,
  deleteIpPhone,
  updateCctv,
  updateIpPhone,
} from "@/server/services/infrastructure";

// The asset page shows the extension, so it is refreshed too.
const PHONES = ["/it/ip-phones", "/it/assets"];
// The asset page shows the CCTV link, so it is refreshed too.
const CCTV = ["/it/cctv", "/it/assets"];

// --- IP phones ---------------------------------------------------------------

export const createIpPhoneAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: ipPhoneSchema,
  audit: { action: "CREATE", entity: "IP_PHONE" },
  handler: async ({ input, ctx, audit }) => {
    const p = await createIpPhone(ctx, input);
    audit.record({
      entityId: p.id,
      summary: `Added extension ${p.extension} on ${p.asset.assetCode}`,
      after: { extension: p.extension, handset: p.asset.assetCode },
    });
    return { id: p.id };
  },
  revalidate: () => PHONES,
});

export const updateIpPhoneAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateIpPhoneSchema,
  audit: { action: "UPDATE", entity: "IP_PHONE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateIpPhone(ctx, input);
    audit.record({
      entityId: after.id,
      summary: `Updated extension ${after.extension}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => PHONES,
});

export const deleteIpPhoneAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "IP_PHONE" },
  handler: async ({ input, ctx, audit }) => {
    const p = await deleteIpPhone(ctx, input.id);
    audit.record({ entityId: p.id, summary: `Removed extension ${p.extension}` });
    return { id: p.id };
  },
  revalidate: () => PHONES,
});

// --- CCTV --------------------------------------------------------------------

export const createCctvAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: cctvSchema,
  audit: { action: "CREATE", entity: "CCTV_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const d = await createCctv(ctx, input);
    audit.record({
      entityId: d.id,
      companyId: d.companyId,
      summary: `Added ${d.type} ${d.assetCode} to CCTV`,
      after: { device: d.assetCode, type: d.type },
    });
    return { id: d.id };
  },
  revalidate: () => CCTV,
});

export const updateCctvAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateCctvSchema,
  audit: { action: "UPDATE", entity: "CCTV_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateCctv(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated CCTV device ${after.device}`,
      before,
      after: { type: after.type, device: after.device, recorderId: after.recorderId },
    });
    return { id: after.id };
  },
  revalidate: () => CCTV,
});

export const deleteCctvAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "CCTV_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const d = await deleteCctv(ctx, input.id);
    audit.record({
      entityId: d.id,
      companyId: d.companyId,
      summary: `Removed ${d.assetCode} from CCTV`,
    });
    return { id: d.id };
  },
  revalidate: () => CCTV,
});
