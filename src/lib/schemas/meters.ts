import { z } from "zod";

/** Utility bills: a hand-kept register of meter numbers, locations, and descriptions. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const meterSchema = z
  .object({
    meterNumber: z.string().trim().min(1, "Meter number is required").max(60),
    location: z.string().trim().min(1, "Location is required").max(200),
    description: optionalText(500),
  })
  .strict();

export const updateMeterSchema = meterSchema.extend({ id: z.string().min(1) });
export type MeterInput = z.infer<typeof meterSchema>;

export const meterIdSchema = z.object({ id: z.string().min(1) }).strict();
