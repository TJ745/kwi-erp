import { z } from "zod";

/** Accommodation, rooms, beds, and occupancy — brief §31. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const requiredDate = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Enter a valid date");

/** Empty string is what an untouched date or number input submits. */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

const optionalDecimal = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()))
  .refine(
    (v) => v === undefined || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0),
    "Enter an amount, to at most two decimal places",
  );

export const RENT_FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const;
export const ACCOMMODATION_TYPES = ["APARTMENT", "VILLA", "CAMP", "HOTEL", "OTHER"] as const;
export const RECORD_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const BED_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "OUT_OF_SERVICE"] as const;

export const accommodationSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    name: z.string().trim().min(2, "Name is required").max(150),
    addressLine: optionalText(250),
    city: optionalText(100),
    type: z.enum(ACCOMMODATION_TYPES).default("APARTMENT"),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
    /** Rent. All optional — a property may be owned, or its lease not yet to hand. */
    rentAmount: optionalDecimal,
    rentCurrency: z.string().trim().length(3).default("SAR"),
    rentFrequency: z
      .enum(RENT_FREQUENCIES)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),
    rentDueDate: optionalDate,
    leaseStartDate: optionalDate,
    leaseEndDate: optionalDate,
    notes: optionalText(1000),
  })
  .strict()
  .refine(
    (v) =>
      v.leaseStartDate === undefined ||
      v.leaseEndDate === undefined ||
      v.leaseEndDate >= v.leaseStartDate,
    { message: "Lease end cannot be before it starts", path: ["leaseEndDate"] },
  );

export const updateAccommodationSchema = accommodationSchema.extend({
  id: z.string().min(1),
});

export type AccommodationInput = z.infer<typeof accommodationSchema>;

export const roomSchema = z
  .object({
    accommodationId: z.string().min(1),
    roomNumber: z.string().trim().min(1, "Room number is required").max(30),
    floor: optionalText(20),
    /**
     * Capacity is how many beds the room is *meant* to hold. It is advisory:
     * the real limit is how many bed records exist, and single occupancy is
     * enforced per bed by a database index, not by this number.
     */
    capacity: z
      .string()
      .default("1")
      .transform((v) => Number(v))
      .refine(
        (v) => Number.isInteger(v) && v >= 1 && v <= 50,
        "Capacity must be a whole number between 1 and 50",
      ),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
  })
  .strict();

export const updateRoomSchema = roomSchema.extend({ id: z.string().min(1) });

export type RoomInput = z.infer<typeof roomSchema>;

export const bedSchema = z
  .object({
    roomId: z.string().min(1),
    bedLabel: z.string().trim().min(1, "Bed label is required").max(20),
    status: z.enum(BED_STATUSES).default("AVAILABLE"),
  })
  .strict();

export const updateBedSchema = bedSchema.extend({ id: z.string().min(1) });

export type BedInput = z.infer<typeof bedSchema>;

export const checkInSchema = z
  .object({
    bedId: z.string().min(1, "Bed is required"),
    employeeId: z.string().min(1, "Employee is required"),
    checkInDate: requiredDate,
    notes: optionalText(500),
  })
  .strict();

export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = z
  .object({
    id: z.string().min(1),
    checkOutDate: requiredDate,
  })
  .strict();

export const accommodationIdSchema = z.object({ id: z.string().min(1) }).strict();
