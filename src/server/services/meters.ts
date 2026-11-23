import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { ConflictError, NotFoundError } from "@/lib/result";
import type { MeterInput } from "@/lib/schemas/meters";

/**
 * Utility bills — a plain register of meter numbers, where each meter is, and
 * a description entered when it is added.
 *
 * Not company scoped: a meter is a fixture of a building, and the list is kept
 * by hand by whoever looks after the premises.
 */

function asDuplicate(error: unknown, meterNumber: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError(`Meter ${meterNumber} is already recorded.`);
  }
  throw error;
}

export async function listMeters(filters: { q?: string | undefined } = {}) {
  return prisma.utilityMeter.findMany({
    where: filters.q
      ? {
          OR: [
            { meterNumber: { contains: filters.q, mode: "insensitive" as const } },
            { location: { contains: filters.q, mode: "insensitive" as const } },
            { description: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {},
    orderBy: [{ location: "asc" }, { meterNumber: "asc" }],
    take: 2000,
    select: { id: true, meterNumber: true, location: true, description: true },
  });
}

export async function createMeter(input: MeterInput) {
  try {
    return await prisma.utilityMeter.create({
      data: {
        meterNumber: input.meterNumber,
        location: input.location,
        description: input.description ?? null,
      },
      select: { id: true, meterNumber: true, location: true },
    });
  } catch (error) {
    asDuplicate(error, input.meterNumber);
  }
}

export async function updateMeter(input: MeterInput & { id: string }) {
  const before = await prisma.utilityMeter.findUnique({
    where: { id: input.id },
    select: { id: true, meterNumber: true, location: true },
  });
  if (!before) throw new NotFoundError("Meter not found.");

  try {
    const after = await prisma.utilityMeter.update({
      where: { id: input.id },
      data: {
        meterNumber: input.meterNumber,
        location: input.location,
        description: input.description ?? null,
      },
      select: { id: true, meterNumber: true, location: true },
    });
    return { before, after };
  } catch (error) {
    asDuplicate(error, input.meterNumber);
  }
}

export async function deleteMeter(id: string) {
  const meter = await prisma.utilityMeter.findUnique({
    where: { id },
    select: { id: true, meterNumber: true, location: true },
  });
  if (!meter) throw new NotFoundError("Meter not found.");
  await prisma.utilityMeter.delete({ where: { id } });
  return meter;
}
