"use server";

import {
  adRecordSchema,
  cctvSchema,
  infrastructureIdSchema,
  ipAddressSchema,
  ipPhoneSchema,
  licenceSchema,
  networkDeviceSchema,
  serverSchema,
  updateAdRecordSchema,
  updateCctvSchema,
  updateIpAddressSchema,
  updateIpPhoneSchema,
  updateLicenceSchema,
  updateNetworkDeviceSchema,
  updateServerSchema,
} from "@/lib/schemas/infrastructure";
import { defineAction } from "./define-action";
import {
  createAdRecord,
  createCctv,
  createIpAddress,
  createIpPhone,
  createLicence,
  createNetworkDevice,
  createServer,
  deleteAdRecord,
  deleteCctv,
  deleteIpAddress,
  deleteIpPhone,
  deleteLicence,
  deleteNetworkDevice,
  deleteServer,
  updateAdRecord,
  updateCctv,
  updateIpAddress,
  updateIpPhone,
  updateLicence,
  updateNetworkDevice,
  updateServer,
} from "@/server/services/infrastructure";

const SERVERS = ["/it/servers"];
const NETWORK = ["/it/network"];
const PHONES = ["/it/ip-phones"];
const CCTV = ["/it/cctv"];
const SOFTWARE = ["/it/software", "/dashboard"];
const AD = ["/it/active-directory"];

// --- Servers -----------------------------------------------------------------

export const createServerAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: serverSchema,
  audit: { action: "CREATE", entity: "SERVER" },
  handler: async ({ input, ctx, audit }) => {
    const s = await createServer(ctx, input);
    audit.record({
      entityId: s.id,
      companyId: s.companyId,
      summary: `Added server ${s.name}${s.ipAddress ? ` (${s.ipAddress})` : ""}`,
      after: { name: s.name, ipAddress: s.ipAddress },
    });
    return { id: s.id };
  },
  revalidate: () => SERVERS,
});

export const updateServerAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateServerSchema,
  audit: { action: "UPDATE", entity: "SERVER" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateServer(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated server ${after.name}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => SERVERS,
});

export const deleteServerAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "SERVER" },
  handler: async ({ input, ctx, audit }) => {
    const s = await deleteServer(ctx, input.id);
    audit.record({
      entityId: s.id,
      companyId: s.companyId,
      summary: `Deleted server ${s.name}`,
    });
    return { id: s.id };
  },
  revalidate: () => SERVERS,
});

// --- Network devices ---------------------------------------------------------

export const createNetworkDeviceAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: networkDeviceSchema,
  audit: { action: "CREATE", entity: "NETWORK_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const d = await createNetworkDevice(ctx, input);
    audit.record({
      entityId: d.id,
      companyId: d.companyId,
      summary: `Added ${d.type} "${d.name}"`,
      after: { name: d.name, type: d.type },
    });
    return { id: d.id };
  },
  revalidate: () => NETWORK,
});

export const updateNetworkDeviceAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateNetworkDeviceSchema,
  audit: { action: "UPDATE", entity: "NETWORK_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateNetworkDevice(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated network device ${after.name}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => NETWORK,
});

export const deleteNetworkDeviceAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "NETWORK_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const d = await deleteNetworkDevice(ctx, input.id);
    audit.record({
      entityId: d.id,
      companyId: d.companyId,
      summary: `Deleted network device ${d.name}`,
    });
    return { id: d.id };
  },
  revalidate: () => NETWORK,
});

// --- IP addresses ------------------------------------------------------------

export const createIpAddressAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: ipAddressSchema,
  audit: { action: "CREATE", entity: "NETWORK_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const ip = await createIpAddress(ctx, input);
    audit.record({
      entityId: ip.id,
      summary: `Recorded IP ${ip.address}`,
      after: { address: ip.address, deviceId: ip.deviceId },
    });
    return { id: ip.id };
  },
  revalidate: () => NETWORK,
});

export const updateIpAddressAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateIpAddressSchema,
  audit: { action: "UPDATE", entity: "NETWORK_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateIpAddress(ctx, input);
    audit.record({
      entityId: after.id,
      summary: `Updated IP ${after.address}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => NETWORK,
});

export const deleteIpAddressAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "NETWORK_DEVICE" },
  handler: async ({ input, ctx, audit }) => {
    const ip = await deleteIpAddress(ctx, input.id);
    audit.record({ entityId: ip.id, summary: `Released IP ${ip.address}` });
    return { id: ip.id };
  },
  revalidate: () => NETWORK,
});

// --- IP phones ---------------------------------------------------------------

export const createIpPhoneAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: ipPhoneSchema,
  audit: { action: "CREATE", entity: "IP_PHONE" },
  handler: async ({ input, ctx, audit }) => {
    const p = await createIpPhone(ctx, input);
    audit.record({
      entityId: p.id,
      summary: `Added extension ${p.extension}`,
      after: { extension: p.extension, employeeId: p.employeeId },
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
      summary: `Added ${d.type} "${d.name}"`,
      after: { name: d.name, type: d.type },
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
      summary: `Updated CCTV device ${after.name}`,
      before: { name: before.name, type: before.type, status: before.status },
      after,
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
      summary: `Deleted CCTV device ${d.name}`,
    });
    return { id: d.id };
  },
  revalidate: () => CCTV,
});

// --- Software licences -------------------------------------------------------

export const createLicenceAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: licenceSchema,
  audit: { action: "CREATE", entity: "SOFTWARE_LICENSE" },
  handler: async ({ input, ctx, audit }) => {
    const l = await createLicence(ctx, input);
    audit.record({
      entityId: l.id,
      companyId: l.companyId,
      summary: `Added licence ${l.name}${l.vendor ? ` (${l.vendor})` : ""} — ${String(l.seats)} seat(s)`,
      // The linked credential is recorded by reference only; the key itself is
      // never read by this module.
      after: {
        name: l.name,
        seats: l.seats,
        expiryDate: l.expiryDate,
        credentialLinked: input.licenseKeyCredentialId !== undefined,
      },
    });
    return { id: l.id };
  },
  revalidate: () => SOFTWARE,
});

export const updateLicenceAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateLicenceSchema,
  audit: { action: "UPDATE", entity: "SOFTWARE_LICENSE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateLicence(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated licence ${after.name} — ${String(after.seatsUsed)}/${String(after.seats)} seats used`,
      before: { seats: before.seats, seatsUsed: before.seatsUsed, expiryDate: before.expiryDate },
      after: { seats: after.seats, seatsUsed: after.seatsUsed, expiryDate: after.expiryDate },
    });
    return { id: after.id };
  },
  revalidate: () => SOFTWARE,
});

export const deleteLicenceAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "SOFTWARE_LICENSE" },
  handler: async ({ input, ctx, audit }) => {
    const l = await deleteLicence(ctx, input.id);
    audit.record({
      entityId: l.id,
      companyId: l.companyId,
      summary: `Deleted licence ${l.name}`,
    });
    return { id: l.id };
  },
  revalidate: () => SOFTWARE,
});

// --- Active Directory --------------------------------------------------------

export const createAdRecordAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: adRecordSchema,
  audit: { action: "CREATE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const r = await createAdRecord(ctx, input);
    audit.record({
      entityId: r.id,
      summary: `Recorded AD account ${r.samAccountName}`,
      after: { samAccountName: r.samAccountName, enabled: r.enabled },
    });
    return { id: r.id };
  },
  revalidate: () => AD,
});

export const updateAdRecordAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: updateAdRecordSchema,
  audit: { action: "UPDATE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateAdRecord(ctx, input);
    audit.record({
      entityId: after.id,
      // Enabling or disabling an account is the change worth spotting here.
      summary: `Updated AD account ${after.samAccountName}${before.enabled !== after.enabled ? ` — ${after.enabled ? "enabled" : "disabled"}` : ""}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => AD,
});

export const deleteAdRecordAction = defineAction({
  permission: "it.infrastructure.manage",
  schema: infrastructureIdSchema,
  audit: { action: "DELETE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const r = await deleteAdRecord(ctx, input.id);
    audit.record({ entityId: r.id, summary: `Deleted AD record ${r.samAccountName}` });
    return { id: r.id };
  },
  revalidate: () => AD,
});
