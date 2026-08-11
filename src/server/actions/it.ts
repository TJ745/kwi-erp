"use server";

import { defineAction } from "./define-action";
import {
  assetSchema,
  assignAssetSchema,
  returnAssetSchema,
  ticketAssignSchema,
  ticketCommentSchema,
  ticketSchema,
  ticketStatusSchema,
  updateAssetSchema,
} from "@/lib/schemas/it";
import { assignAsset, createAsset, returnAsset, updateAsset } from "@/server/services/assets";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  setTicketStatus,
} from "@/server/services/helpdesk";

// --- Assets ------------------------------------------------------------------

export const createAssetAction = defineAction({
  permission: "it.assets.manage",
  schema: assetSchema,
  audit: { action: "CREATE", entity: "IT_ASSET" },
  handler: async ({ input, ctx, audit }) => {
    const asset = await createAsset(ctx, input);
    audit.record({
      entityId: asset.id,
      companyId: asset.companyId,
      summary: `Registered asset ${asset.assetCode} — ${asset.brand} ${asset.model}`,
      after: { assetCode: asset.assetCode, type: input.type },
    });
    return { id: asset.id, assetCode: asset.assetCode };
  },
  revalidate: () => ["/it/assets", "/dashboard"],
});

export const updateAssetAction = defineAction({
  permission: "it.assets.manage",
  schema: updateAssetSchema,
  audit: { action: "UPDATE", entity: "IT_ASSET" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateAsset(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated asset ${after.assetCode}`,
      before: {
        brand: before.brand,
        model: before.model,
        serialNumber: before.serialNumber,
        warrantyExpiry: before.warrantyExpiry,
      },
      after: {
        brand: input.brand,
        model: input.model,
        serialNumber: input.serialNumber ?? null,
        warrantyExpiry: after.warrantyExpiry,
      },
    });
    return { id: after.id };
  },
  revalidate: (input) => ["/it/assets", `/it/assets/${input.id}`, "/dashboard"],
});

export const assignAssetAction = defineAction({
  permission: "it.assets.assign",
  schema: assignAssetSchema,
  audit: { action: "ASSIGN", entity: "IT_ASSET" },
  handler: async ({ input, ctx, audit }) => {
    const result = await assignAsset(ctx, input);
    audit.record({
      entityId: input.assetId,
      companyId: result.companyId,
      summary: `Issued ${result.assetCode} to ${result.employeeName} (condition ${input.conditionOut.toLowerCase()})`,
      after: { employee: result.employeeName, condition: input.conditionOut },
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/it/assets", `/it/assets/${input.assetId}`],
});

export const returnAssetAction = defineAction({
  permission: "it.assets.assign",
  schema: returnAssetSchema,
  audit: { action: "RETURN", entity: "IT_ASSET" },
  handler: async ({ input, ctx, audit }) => {
    const result = await returnAsset(ctx, input);
    audit.record({
      entityId: input.assetId,
      companyId: result.companyId,
      summary: `${result.assetCode} returned by ${result.employeeName} (condition ${input.conditionIn.toLowerCase()}, now ${result.nextStatus.toLowerCase()})`,
      after: { condition: input.conditionIn, status: result.nextStatus },
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/it/assets", `/it/assets/${input.assetId}`],
});

// --- Helpdesk ----------------------------------------------------------------

export const createTicketAction = defineAction({
  permission: "it.tickets.create",
  schema: ticketSchema,
  audit: { action: "CREATE", entity: "IT_TICKET" },
  handler: async ({ input, ctx, audit }) => {
    const ticket = await createTicket(ctx, input);
    audit.record({
      entityId: ticket.id,
      companyId: ticket.companyId,
      summary: `Raised ticket ${ticket.ticketNo} — ${ticket.subject}`,
      after: { subject: ticket.subject, priority: input.priority },
    });
    return { id: ticket.id, ticketNo: ticket.ticketNo };
  },
  revalidate: () => ["/it/helpdesk"],
});

export const assignTicketAction = defineAction({
  permission: "it.tickets.assign",
  schema: ticketAssignSchema,
  audit: { action: "ASSIGN", entity: "IT_TICKET" },
  handler: async ({ input, ctx, audit }) => {
    const result = await assignTicket(ctx, input);
    audit.record({
      entityId: input.id,
      companyId: result.companyId,
      summary: `Ticket ${result.ticketNo} assigned to ${result.after.assignedTo ?? "nobody"}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/it/helpdesk", `/it/helpdesk/${input.id}`],
});

export const setTicketStatusAction = defineAction({
  permission: "it.tickets.resolve",
  schema: ticketStatusSchema,
  audit: { action: "UPDATE", entity: "IT_TICKET" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setTicketStatus(ctx, input);
    audit.record({
      entityId: input.id,
      companyId: result.companyId,
      summary: `Ticket ${result.ticketNo}: ${result.before.status} → ${result.after.status}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/it/helpdesk", `/it/helpdesk/${input.id}`],
});

export const addTicketCommentAction = defineAction({
  permission: "it.tickets.view",
  schema: ticketCommentSchema,
  audit: { action: "UPDATE", entity: "IT_TICKET" },
  handler: async ({ input, ctx, audit }) => {
    const result = await addTicketComment(ctx, input);
    audit.record({
      entityId: input.ticketId,
      companyId: result.companyId,
      summary: `Comment added to ${result.ticketNo}${input.isInternal ? " (internal)" : ""}`,
    });
    return { ok: true as const };
  },
  revalidate: (input) => [`/it/helpdesk/${input.ticketId}`],
});
