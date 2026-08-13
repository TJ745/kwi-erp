"use server";

import {
  accommodationIdSchema,
  accommodationSchema,
  bedSchema,
  checkInSchema,
  checkOutSchema,
  roomSchema,
  updateAccommodationSchema,
  updateBedSchema,
  updateRoomSchema,
} from "@/lib/schemas/accommodation";
import { defineAction } from "./define-action";
import {
  checkIn,
  checkOut,
  createAccommodation,
  createBed,
  createRoom,
  deleteAccommodation,
  deleteBed,
  deleteRoom,
  updateAccommodation,
  updateBed,
  updateRoom,
} from "@/server/services/accommodation";

const PATHS = ["/admin/accommodation"];

export const createAccommodationAction = defineAction({
  permission: "accommodation.manage",
  schema: accommodationSchema,
  audit: { action: "CREATE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const a = await createAccommodation(ctx, input);
    audit.record({
      entityId: a.id,
      companyId: a.companyId,
      summary: `Added ${a.type.toLowerCase()} "${a.name}"`,
      after: { name: a.name, type: a.type },
    });
    return { id: a.id };
  },
  revalidate: () => PATHS,
});

export const updateAccommodationAction = defineAction({
  permission: "accommodation.manage",
  schema: updateAccommodationSchema,
  audit: { action: "UPDATE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateAccommodation(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated accommodation "${after.name}"`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => PATHS,
});

export const deleteAccommodationAction = defineAction({
  permission: "accommodation.manage",
  schema: accommodationIdSchema,
  audit: { action: "DELETE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const a = await deleteAccommodation(ctx, input.id);
    audit.record({
      entityId: a.id,
      companyId: a.companyId,
      summary: `Deleted accommodation "${a.name}"`,
    });
    return { id: a.id };
  },
  revalidate: () => PATHS,
});

// --- Rooms -------------------------------------------------------------------

export const createRoomAction = defineAction({
  permission: "accommodation.manage",
  schema: roomSchema,
  audit: { action: "CREATE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const room = await createRoom(ctx, input);
    audit.record({
      entityId: room.id,
      companyId: room.companyId,
      summary: `Added room ${room.roomNumber} to ${room.accommodationName}`,
      after: { roomNumber: room.roomNumber, capacity: room.capacity },
    });
    return { id: room.id };
  },
  revalidate: () => PATHS,
});

export const updateRoomAction = defineAction({
  permission: "accommodation.manage",
  schema: updateRoomSchema,
  audit: { action: "UPDATE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, companyId } = await updateRoom(ctx, input);
    audit.record({
      entityId: after.id,
      companyId,
      summary: `Updated room ${after.roomNumber}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => PATHS,
});

export const deleteRoomAction = defineAction({
  permission: "accommodation.manage",
  schema: accommodationIdSchema,
  audit: { action: "DELETE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const room = await deleteRoom(ctx, input.id);
    audit.record({
      entityId: room.id,
      companyId: room.companyId,
      summary: `Deleted room ${room.roomNumber} from ${room.accommodationName}`,
    });
    return { id: room.id };
  },
  revalidate: () => PATHS,
});

// --- Beds --------------------------------------------------------------------

export const createBedAction = defineAction({
  permission: "accommodation.manage",
  schema: bedSchema,
  audit: { action: "CREATE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const bed = await createBed(ctx, input);
    audit.record({
      entityId: bed.id,
      companyId: bed.companyId,
      summary: `Added bed ${bed.bedLabel} to room ${bed.roomNumber}`,
      after: { bedLabel: bed.bedLabel, status: bed.status },
    });
    return { id: bed.id };
  },
  revalidate: () => PATHS,
});

export const updateBedAction = defineAction({
  permission: "accommodation.manage",
  schema: updateBedSchema,
  audit: { action: "UPDATE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, companyId } = await updateBed(ctx, input);
    audit.record({
      entityId: after.id,
      companyId,
      summary: `Updated bed ${after.bedLabel}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => PATHS,
});

export const deleteBedAction = defineAction({
  permission: "accommodation.manage",
  schema: accommodationIdSchema,
  audit: { action: "DELETE", entity: "ACCOMMODATION" },
  handler: async ({ input, ctx, audit }) => {
    const bed = await deleteBed(ctx, input.id);
    audit.record({
      entityId: bed.id,
      companyId: bed.companyId,
      summary: `Deleted bed ${bed.bedLabel} from room ${bed.roomNumber}`,
    });
    return { id: bed.id };
  },
  revalidate: () => PATHS,
});

// --- Occupancy ---------------------------------------------------------------

export const checkInAction = defineAction({
  permission: "accommodation.manage",
  schema: checkInSchema,
  audit: { action: "ASSIGN", entity: "BED_ASSIGNMENT" },
  handler: async ({ input, ctx, audit }) => {
    const result = await checkIn(ctx, input);
    audit.record({
      entityId: result.id,
      companyId: result.companyId,
      summary: `Checked ${result.employeeName} into ${result.accommodationName}, room ${result.roomNumber}, bed ${result.bedLabel}`,
      after: { checkInDate: result.checkInDate, bed: result.bedLabel },
    });
    return { id: result.id };
  },
  revalidate: () => PATHS,
});

export const checkOutAction = defineAction({
  permission: "accommodation.manage",
  schema: checkOutSchema,
  audit: { action: "RETURN", entity: "BED_ASSIGNMENT" },
  handler: async ({ input, ctx, audit }) => {
    const result = await checkOut(ctx, input);
    audit.record({
      entityId: result.id,
      companyId: result.companyId,
      summary: `Checked ${result.employeeName} out of ${result.accommodationName}, room ${result.roomNumber}, bed ${result.bedLabel}`,
      after: { checkOutDate: input.checkOutDate },
    });
    return { id: result.id };
  },
  revalidate: () => PATHS,
});
