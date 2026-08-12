"use server";

import { defineAction } from "./define-action";
import {
  assignDriverSchema,
  maintenanceSchema,
  unassignDriverSchema,
  updateVehicleSchema,
  vehicleHandoverSchema,
  vehicleSchema,
} from "@/lib/schemas/fleet";
import {
  addMaintenance,
  assignDriver,
  createVehicle,
  recordHandover,
  unassignDriver,
  updateVehicle,
} from "@/server/services/fleet";

export const createVehicleAction = defineAction({
  permission: "vehicles.manage",
  schema: vehicleSchema,
  audit: { action: "CREATE", entity: "VEHICLE" },
  handler: async ({ input, ctx, audit }) => {
    const vehicle = await createVehicle(ctx, input);
    audit.record({
      entityId: vehicle.id,
      companyId: vehicle.companyId,
      summary: `Registered vehicle ${vehicle.vehicleCode} — ${vehicle.plateNumber}`,
      after: {
        plateNumber: vehicle.plateNumber,
        registrationExpiry: vehicle.registrationExpiry,
        insuranceExpiry: vehicle.insuranceExpiry,
      },
    });
    return { id: vehicle.id, vehicleCode: vehicle.vehicleCode };
  },
  revalidate: () => ["/vehicles", "/dashboard"],
});

export const updateVehicleAction = defineAction({
  permission: "vehicles.manage",
  schema: updateVehicleSchema,
  audit: { action: "UPDATE", entity: "VEHICLE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateVehicle(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated vehicle ${after.plateNumber}`,
      before: {
        plateNumber: before.plateNumber,
        status: before.status,
        registrationExpiry: before.registrationExpiry,
        insuranceExpiry: before.insuranceExpiry,
      },
      after: {
        plateNumber: after.plateNumber,
        status: after.status,
        registrationExpiry: after.registrationExpiry,
        insuranceExpiry: after.insuranceExpiry,
      },
    });
    return { id: after.id };
  },
  revalidate: (input) => ["/vehicles", `/vehicles/${input.id}`, "/dashboard"],
});

export const assignDriverAction = defineAction({
  permission: "vehicles.assign",
  schema: assignDriverSchema,
  audit: { action: "ASSIGN", entity: "VEHICLE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await assignDriver(ctx, input);
    audit.record({
      entityId: input.vehicleId,
      companyId: result.companyId,
      summary: `Assigned ${result.plateNumber} to ${result.employeeName}`,
      after: { driver: result.employeeName },
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/vehicles", `/vehicles/${input.vehicleId}`],
});

export const unassignDriverAction = defineAction({
  permission: "vehicles.assign",
  schema: unassignDriverSchema,
  audit: { action: "UNASSIGN", entity: "VEHICLE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await unassignDriver(ctx, input.vehicleId);
    audit.record({
      entityId: input.vehicleId,
      companyId: result.companyId,
      summary: `Unassigned ${result.plateNumber} from ${result.employeeName}`,
      before: { driver: result.employeeName },
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/vehicles", `/vehicles/${input.vehicleId}`],
});

export const addMaintenanceAction = defineAction({
  permission: "vehicles.maintenance.manage",
  schema: maintenanceSchema,
  audit: { action: "CREATE", entity: "VEHICLE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await addMaintenance(ctx, input);
    audit.record({
      entityId: input.vehicleId,
      companyId: result.companyId,
      summary: `Recorded ${input.type.replace(/_/g, " ").toLowerCase()} on ${result.plateNumber}`,
      after: { type: input.type, date: input.date, mileage: input.mileage ?? null },
    });
    return { id: result.record.id };
  },
  revalidate: (input) => [
    "/vehicles",
    `/vehicles/${input.vehicleId}`,
    "/vehicles/maintenance",
  ],
});

export const recordHandoverAction = defineAction({
  permission: "vehicles.assign",
  schema: vehicleHandoverSchema,
  audit: { action: "ASSIGN", entity: "VEHICLE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await recordHandover(ctx, input);
    audit.record({
      entityId: input.vehicleId,
      companyId: result.companyId,
      summary: `Vehicle handover recorded for ${result.plateNumber}`,
      after: {
        handoverDate: input.handoverDate,
        mileage: input.mileage ?? null,
        fuelLevel: input.fuelLevel,
        condition: input.condition,
      },
    });
    return { id: result.id };
  },
  revalidate: (input) => [
    "/vehicles",
    `/vehicles/${input.vehicleId}`,
    "/vehicles/handovers",
  ],
});
