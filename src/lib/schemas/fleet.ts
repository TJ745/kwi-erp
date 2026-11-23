import { z } from "zod";
import { MAINTENANCE_SERVICE_KEYS } from "@/lib/vehicle-maintenance";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

const optionalInt = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0), "Enter a whole number");

export const VEHICLE_STATUSES = [
  "ACTIVE",
  "IN_MAINTENANCE",
  "OUT_OF_SERVICE",
  "SOLD",
  "DISPOSED",
] as const;

export const MAINTENANCE_TYPES = [
  "ROUTINE_SERVICE",
  "OIL_CHANGE",
  "TYRES",
  "BRAKES",
  "BODYWORK",
  "ELECTRICAL",
  "AC",
  "INSPECTION",
  "REPAIR",
  "OTHER",
] as const;

export const FUEL_LEVELS = ["EMPTY", "QUARTER", "HALF", "THREE_QUARTER", "FULL"] as const;

const vehicleSchemaObject = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    plateNumber: z.string().trim().min(2, "Plate number is required").max(20),
    plateNumberAr: optionalText(20),
    make: z.string().trim().min(1, "Make is required").max(60),
    model: z.string().trim().min(1, "Model is required").max(80),
    year: z
      .string()
      .min(4, "Year is required")
      .transform((v) => Number(v))
      .refine(
        (v) => Number.isInteger(v) && v >= 1950 && v <= new Date().getFullYear() + 2,
        "Enter a valid year",
      ),
    color: optionalText(40),
    vin: optionalText(40),
    status: z.enum(VEHICLE_STATUSES).default("ACTIVE"),
    currentMileage: optionalInt,

    registrationNo: optionalText(60),
    registrationExpiry: optionalDate,

    insurancePolicyNo: optionalText(60),
    insuranceProvider: optionalText(120),
    insuranceExpiry: optionalDate,

    notes: optionalText(1000),
  })
  .strict();

export const vehicleSchema = vehicleSchemaObject;

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const updateVehicleSchema = vehicleSchemaObject.extend({ id: z.string().min(1) });

export const assignDriverSchema = z
  .object({
    vehicleId: z.string().min(1),
    employeeId: z.string().min(1, "Select a driver"),
    notes: optionalText(500),
  })
  .strict();

export const unassignDriverSchema = z.object({ vehicleId: z.string().min(1) }).strict();

export const maintenanceSchema = z
  .object({
    vehicleId: z.string().min(1),
    date: requiredDate,
    type: z.enum(MAINTENANCE_TYPES),
    /** Blank uses the requested services as the description. */
    description: optionalText(1000),
    mileage: optionalInt,
    workshop: optionalText(150),
    cost: optionalMoney,
    nextDueDate: optionalDate,
    nextDueMileage: optionalInt,
    notes: optionalText(1000),
    // The printed maintenance request.
    requestNo: optionalText(40),
    driverId: optionalText(40),
    services: z.array(z.enum(MAINTENANCE_SERVICE_KEYS)).max(20).default([]),
    otherService: optionalText(200),
    additionalDetails: optionalText(1000),
    driverNotes: optionalText(1000),
    requiredParts: optionalText(1000),
  })
  .strict()
  .refine((d) => d.description !== undefined || d.services.length > 0, {
    message: "Describe the work or tick the services required",
    path: ["description"],
  })
  .refine((d) => !d.nextDueDate || d.nextDueDate.getTime() >= d.date.getTime(), {
    message: "The next service cannot be due before this one",
    path: ["nextDueDate"],
  });

export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

export const vehicleHandoverSchema = z
  .object({
    vehicleId: z.string().min(1),
    toEmployeeId: z
      .string()
      .optional()
      .transform((v) => (v === "" || v === "none" ? undefined : v)),
    handoverDate: requiredDate,
    mileage: optionalInt,
    fuelLevel: z.enum(FUEL_LEVELS),
    condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]),
    accessories: optionalText(500),
    /** One note per line; each prints as a numbered note on the letter. */
    damages: optionalText(2000),
    remarks: optionalText(1000),
    vehicleLabel: optionalText(40),
  })
  .strict();

export type VehicleHandoverInput = z.infer<typeof vehicleHandoverSchema>;
