import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import type {
  AccommodationInput,
  BedInput,
  CheckInInput,
  RoomInput,
} from "@/lib/schemas/accommodation";

/**
 * Accommodation — brief §31.
 *
 * "One occupant per bed" is enforced by a PARTIAL UNIQUE INDEX (Phase 2,
 * proven under concurrent inserts):
 *
 *   CREATE UNIQUE INDEX bed_single_active_occupant
 *     ON "BedAssignment" ("bedId") WHERE "checkOutDate" IS NULL;
 *
 * The pre-check below exists only to produce a sentence naming the current
 * occupant. The index is what makes the rule true when two admins check two
 * people into the same bed at the same moment — a pre-check alone races.
 */

export async function listAccommodations(
  ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
) {
  const accommodations = await prisma.accommodation.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { city: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      addressLine: true,
      city: true,
      type: true,
      status: true,
      notes: true,
      companyId: true,
      company: { select: { code: true } },
      rooms: {
        select: {
          id: true,
          beds: {
            select: {
              id: true,
              status: true,
              assignments: {
                where: { checkOutDate: null },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  return accommodations.map((a) => {
    const beds = a.rooms.flatMap((r) => r.beds);
    // Occupancy is counted from live assignments, not from BedStatus — the
    // status is a label someone maintains, the assignment is the fact.
    const occupied = beds.filter((b) => b.assignments.length > 0).length;
    const outOfService = beds.filter((b) => b.status === "OUT_OF_SERVICE").length;

    return {
      id: a.id,
      name: a.name,
      addressLine: a.addressLine,
      city: a.city,
      type: a.type,
      status: a.status,
      notes: a.notes,
      companyId: a.companyId,
      companyCode: a.company.code,
      roomCount: a.rooms.length,
      bedCount: beds.length,
      occupied,
      outOfService,
      available: beds.length - occupied - outOfService,
    };
  });
}

export async function getAccommodation(ctx: ActorContext, id: string) {
  const accommodation = await prisma.accommodation.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      addressLine: true,
      city: true,
      type: true,
      status: true,
      notes: true,
      rentAmount: true,
      rentCurrency: true,
      rentFrequency: true,
      rentDueDate: true,
      leaseStartDate: true,
      leaseEndDate: true,
      companyId: true,
      company: { select: { code: true } },
      rooms: {
        orderBy: { roomNumber: "asc" },
        select: {
          id: true,
          roomNumber: true,
          floor: true,
          capacity: true,
          status: true,
          beds: {
            orderBy: { bedLabel: "asc" },
            select: {
              id: true,
              bedLabel: true,
              status: true,
              assignments: {
                where: { checkOutDate: null },
                select: {
                  id: true,
                  checkInDate: true,
                  notes: true,
                  employee: {
                    select: { id: true, fullName: true, employeeNo: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!accommodation) throw new NotFoundError("Accommodation not found.");
  return accommodation;
}

// --- Accommodation -----------------------------------------------------------

export async function createAccommodation(ctx: ActorContext, input: AccommodationInput) {
  requireCompanyAccess(ctx, input.companyId);

  return prisma.accommodation.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      type: input.type,
      status: input.status,
      rentAmount: input.rentAmount ?? null,
      rentCurrency: input.rentCurrency,
      rentFrequency: input.rentFrequency ?? null,
      rentDueDate: input.rentDueDate ?? null,
      leaseStartDate: input.leaseStartDate ?? null,
      leaseEndDate: input.leaseEndDate ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, companyId: true, type: true },
  });
}

export async function updateAccommodation(
  ctx: ActorContext,
  input: AccommodationInput & { id: string },
) {
  const before = await prisma.accommodation.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, name: true, type: true, status: true, city: true, companyId: true },
  });
  if (!before) throw new NotFoundError("Accommodation not found.");
  requireCompanyAccess(ctx, input.companyId);

  const after = await prisma.accommodation.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      name: input.name,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      type: input.type,
      status: input.status,
      rentAmount: input.rentAmount ?? null,
      rentCurrency: input.rentCurrency,
      rentFrequency: input.rentFrequency ?? null,
      rentDueDate: input.rentDueDate ?? null,
      leaseStartDate: input.leaseStartDate ?? null,
      leaseEndDate: input.leaseEndDate ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, type: true, status: true, city: true, companyId: true },
  });

  return { before, after };
}

export async function deleteAccommodation(ctx: ActorContext, id: string) {
  const accommodation = await prisma.accommodation.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      companyId: true,
      rooms: {
        select: {
          beds: { select: { assignments: { where: { checkOutDate: null }, select: { id: true } } } },
        },
      },
    },
  });
  if (!accommodation) throw new NotFoundError("Accommodation not found.");

  const occupants = accommodation.rooms
    .flatMap((r) => r.beds)
    .reduce((sum, b) => sum + b.assignments.length, 0);

  // Deleting a property with people living in it would orphan their records
  // and quietly lose where they sleep.
  if (occupants > 0) {
    throw new ConflictError(
      `${accommodation.name} still has ${String(occupants)} occupant(s). Check them out first.`,
    );
  }

  // Past stays block deletion too. BedAssignment has no cascade from bed —
  // deliberately, because who slept where is a record worth keeping. Deleting
  // the history to make the delete succeed would destroy exactly that.
  const history = await prisma.bedAssignment.count({
    where: { bed: { room: { accommodationId: id } } },
  });
  if (history > 0) {
    throw new ConflictError(
      `${accommodation.name} has ${String(history)} past stay(s) on record. Set its status to Archived instead of deleting it.`,
    );
  }

  await prisma.accommodation.delete({ where: { id } });
  return accommodation;
}

// --- Rooms and beds ----------------------------------------------------------

async function assertAccommodationInScope(ctx: ActorContext, accommodationId: string) {
  const accommodation = await prisma.accommodation.findFirst({
    where: { id: accommodationId, ...companyScopeWhere(ctx) },
    select: { id: true, companyId: true, name: true },
  });
  if (!accommodation) throw new NotFoundError("Accommodation not found.");
  return accommodation;
}

export async function createRoom(ctx: ActorContext, input: RoomInput) {
  const accommodation = await assertAccommodationInScope(ctx, input.accommodationId);

  const clash = await prisma.accommodationRoom.findFirst({
    where: { accommodationId: input.accommodationId, roomNumber: input.roomNumber },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(
      `${accommodation.name} already has a room ${input.roomNumber}.`,
    );
  }

  const room = await prisma.accommodationRoom.create({
    data: {
      accommodationId: input.accommodationId,
      roomNumber: input.roomNumber,
      floor: input.floor ?? null,
      capacity: input.capacity,
      status: input.status,
    },
    select: { id: true, roomNumber: true, capacity: true },
  });

  return { ...room, accommodationName: accommodation.name, companyId: accommodation.companyId };
}

export async function updateRoom(ctx: ActorContext, input: RoomInput & { id: string }) {
  const accommodation = await assertAccommodationInScope(ctx, input.accommodationId);

  const before = await prisma.accommodationRoom.findFirst({
    where: { id: input.id, accommodationId: input.accommodationId },
    select: { id: true, roomNumber: true, capacity: true, status: true },
  });
  if (!before) throw new NotFoundError("Room not found.");

  const clash = await prisma.accommodationRoom.findFirst({
    where: {
      accommodationId: input.accommodationId,
      roomNumber: input.roomNumber,
      id: { not: input.id },
    },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`Room ${input.roomNumber} already exists here.`);

  const after = await prisma.accommodationRoom.update({
    where: { id: input.id },
    data: {
      roomNumber: input.roomNumber,
      floor: input.floor ?? null,
      capacity: input.capacity,
      status: input.status,
    },
    select: { id: true, roomNumber: true, capacity: true, status: true },
  });

  return { before, after, companyId: accommodation.companyId };
}

export async function deleteRoom(ctx: ActorContext, id: string) {
  const room = await prisma.accommodationRoom.findUnique({
    where: { id },
    select: {
      id: true,
      roomNumber: true,
      accommodationId: true,
      beds: { select: { assignments: { where: { checkOutDate: null }, select: { id: true } } } },
    },
  });
  if (!room) throw new NotFoundError("Room not found.");
  const accommodation = await assertAccommodationInScope(ctx, room.accommodationId);

  const occupants = room.beds.reduce((sum, b) => sum + b.assignments.length, 0);
  if (occupants > 0) {
    throw new ConflictError(
      `Room ${room.roomNumber} still has ${String(occupants)} occupant(s). Check them out first.`,
    );
  }

  const history = await prisma.bedAssignment.count({ where: { bed: { roomId: id } } });
  if (history > 0) {
    throw new ConflictError(
      `Room ${room.roomNumber} has ${String(history)} past stay(s) on record. Set it to Inactive instead of deleting it.`,
    );
  }

  // Beds cascade with the room once nothing references them.
  await prisma.accommodationRoom.delete({ where: { id } });
  return { ...room, companyId: accommodation.companyId, accommodationName: accommodation.name };
}

async function assertBedInScope(ctx: ActorContext, bedId: string) {
  const bed = await prisma.accommodationBed.findUnique({
    where: { id: bedId },
    select: {
      id: true,
      bedLabel: true,
      status: true,
      room: {
        select: {
          id: true,
          roomNumber: true,
          accommodation: { select: { id: true, name: true, companyId: true } },
        },
      },
    },
  });
  if (!bed) throw new NotFoundError("Bed not found.");
  await assertAccommodationInScope(ctx, bed.room.accommodation.id);
  return bed;
}

export async function createBed(ctx: ActorContext, input: BedInput) {
  const room = await prisma.accommodationRoom.findUnique({
    where: { id: input.roomId },
    select: { id: true, roomNumber: true, capacity: true, accommodationId: true, _count: { select: { beds: true } } },
  });
  if (!room) throw new NotFoundError("Room not found.");
  const accommodation = await assertAccommodationInScope(ctx, room.accommodationId);

  const clash = await prisma.accommodationBed.findFirst({
    where: { roomId: input.roomId, bedLabel: input.bedLabel },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(`Room ${room.roomNumber} already has a bed ${input.bedLabel}.`);
  }

  // Capacity is advisory, so exceeding it is refused with a message that says
  // what to change rather than silently allowing an over-full room.
  if (room._count.beds >= room.capacity) {
    throw new ConflictError(
      `Room ${room.roomNumber} is set to hold ${String(room.capacity)} bed(s). Raise its capacity first.`,
    );
  }

  const bed = await prisma.accommodationBed.create({
    data: { roomId: input.roomId, bedLabel: input.bedLabel, status: input.status },
    select: { id: true, bedLabel: true, status: true },
  });

  return { ...bed, roomNumber: room.roomNumber, companyId: accommodation.companyId };
}

export async function updateBed(ctx: ActorContext, input: BedInput & { id: string }) {
  const bed = await assertBedInScope(ctx, input.id);

  const occupied = await prisma.bedAssignment.findFirst({
    where: { bedId: input.id, checkOutDate: null },
    select: { employee: { select: { fullName: true } } },
  });

  // Taking an occupied bed out of service would leave someone assigned to a
  // bed the system says does not exist.
  if (occupied && input.status === "OUT_OF_SERVICE") {
    throw new ConflictError(
      `${occupied.employee.fullName} is in this bed. Check them out before taking it out of service.`,
    );
  }

  const after = await prisma.accommodationBed.update({
    where: { id: input.id },
    data: { bedLabel: input.bedLabel, status: input.status },
    select: { id: true, bedLabel: true, status: true },
  });

  return {
    before: { bedLabel: bed.bedLabel, status: bed.status },
    after,
    companyId: bed.room.accommodation.companyId,
  };
}

export async function deleteBed(ctx: ActorContext, id: string) {
  const bed = await assertBedInScope(ctx, id);

  const occupied = await prisma.bedAssignment.findFirst({
    where: { bedId: id, checkOutDate: null },
    select: { employee: { select: { fullName: true } } },
  });
  if (occupied) {
    throw new ConflictError(
      `${occupied.employee.fullName} is in this bed. Check them out first.`,
    );
  }

  // An earlier version deleted the assignment history to make this succeed.
  // That silently destroyed the record of who had slept there, which is the
  // one thing this table exists to remember.
  const history = await prisma.bedAssignment.count({ where: { bedId: id } });
  if (history > 0) {
    throw new ConflictError(
      `This bed has ${String(history)} past stay(s) on record. Set it to Out of service instead of deleting it.`,
    );
  }

  await prisma.accommodationBed.delete({ where: { id } });

  return {
    id: bed.id,
    bedLabel: bed.bedLabel,
    roomNumber: bed.room.roomNumber,
    companyId: bed.room.accommodation.companyId,
  };
}

// --- Occupancy ---------------------------------------------------------------

/** Postgres unique-violation, raised by the partial index. */
const UNIQUE_VIOLATION = "P2002";

export async function checkIn(ctx: ActorContext, input: CheckInInput) {
  const bed = await assertBedInScope(ctx, input.bedId);

  if (bed.status === "OUT_OF_SERVICE") {
    throw new ConflictError("That bed is out of service.");
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: input.employeeId,
      companyId: bed.room.accommodation.companyId,
      deletedAt: null,
    },
    select: { id: true, fullName: true, employeeNo: true },
  });
  if (!employee) {
    throw new NotFoundError("Employee not found in the accommodation's company.");
  }

  // An employee occupying two beds at once is as wrong as two employees in
  // one bed, but there is no index for it — one person, one row.
  const elsewhere = await prisma.bedAssignment.findFirst({
    where: { employeeId: input.employeeId, checkOutDate: null },
    select: {
      bed: {
        select: {
          bedLabel: true,
          room: {
            select: { roomNumber: true, accommodation: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (elsewhere) {
    throw new ConflictError(
      `${employee.fullName} is already in ${elsewhere.bed.room.accommodation.name}, room ${elsewhere.bed.room.roomNumber}, bed ${elsewhere.bed.bedLabel}. Check them out first.`,
    );
  }

  // Friendly message only; the partial unique index is the real guarantee.
  const occupied = await prisma.bedAssignment.findFirst({
    where: { bedId: input.bedId, checkOutDate: null },
    select: { employee: { select: { fullName: true } } },
  });
  if (occupied) {
    throw new ConflictError(
      `That bed is occupied by ${occupied.employee.fullName}. Check them out first.`,
    );
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.bedAssignment.create({
        data: {
          bedId: input.bedId,
          employeeId: input.employeeId,
          checkInDate: input.checkInDate,
          assignedById: ctx.userId,
          notes: input.notes ?? null,
        },
        select: { id: true, checkInDate: true },
      });

      await tx.accommodationBed.update({
        where: { id: input.bedId },
        data: { status: "OCCUPIED" },
      });

      return created;
    });

    return {
      ...assignment,
      employeeName: employee.fullName,
      bedLabel: bed.bedLabel,
      roomNumber: bed.room.roomNumber,
      accommodationName: bed.room.accommodation.name,
      companyId: bed.room.accommodation.companyId,
    };
  } catch (error) {
    // The race the pre-check cannot close: two check-ins for the same bed
    // arriving together. One of them lands here.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      throw new ConflictError(
        "Someone else was checked into that bed a moment ago. Refresh and try another bed.",
      );
    }
    throw error;
  }
}

export async function checkOut(
  ctx: ActorContext,
  input: { id: string; checkOutDate: Date },
) {
  const assignment = await prisma.bedAssignment.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      bedId: true,
      checkInDate: true,
      checkOutDate: true,
      employee: { select: { fullName: true } },
      bed: {
        select: {
          bedLabel: true,
          room: {
            select: {
              roomNumber: true,
              accommodation: { select: { id: true, name: true, companyId: true } },
            },
          },
        },
      },
    },
  });
  if (!assignment) throw new NotFoundError("Assignment not found.");
  await assertAccommodationInScope(ctx, assignment.bed.room.accommodation.id);

  if (assignment.checkOutDate) {
    throw new ConflictError("That occupant has already been checked out.");
  }
  if (input.checkOutDate.getTime() < assignment.checkInDate.getTime()) {
    throw new ConflictError("Check-out cannot precede check-in.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bedAssignment.update({
      where: { id: input.id },
      data: { checkOutDate: input.checkOutDate },
    });
    // Freeing the bed is what lets the partial index accept the next occupant.
    await tx.accommodationBed.update({
      where: { id: assignment.bedId },
      data: { status: "AVAILABLE" },
    });
  });

  return {
    id: assignment.id,
    employeeName: assignment.employee.fullName,
    bedLabel: assignment.bed.bedLabel,
    roomNumber: assignment.bed.room.roomNumber,
    accommodationName: assignment.bed.room.accommodation.name,
    companyId: assignment.bed.room.accommodation.companyId,
  };
}

/** Employees in this company who are not currently housed. */
export async function unhousedEmployees(ctx: ActorContext, companyId: string) {
  requireCompanyAccess(ctx, companyId);

  return prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      bedAssignments: { none: { checkOutDate: null } },
    },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, employeeNo: true },
  });
}

export async function accommodationCounts(ctx: ActorContext) {
  const accommodations = await listAccommodations(ctx);
  return accommodations.reduce(
    (acc, a) => ({
      properties: acc.properties + 1,
      beds: acc.beds + a.bedCount,
      occupied: acc.occupied + a.occupied,
      available: acc.available + a.available,
    }),
    { properties: 0, beds: 0, occupied: 0, available: 0 },
  );
}

/**
 * An employee's accommodation history, for their profile tab.
 *
 * Ordered current-first: the open assignment (no check-out) is what matters
 * during offboarding, and the rest is history.
 */
export async function accommodationForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.bedAssignment.findMany({
    where: {
      employeeId,
      bed: { room: { accommodation: companyScopeWhere(ctx) } },
    },
    orderBy: [{ checkOutDate: { sort: "asc", nulls: "first" } }, { checkInDate: "desc" }],
    take: 50,
    select: {
      id: true,
      checkInDate: true,
      checkOutDate: true,
      notes: true,
      bed: {
        select: {
          bedLabel: true,
          room: {
            select: {
              roomNumber: true,
              accommodation: { select: { id: true, name: true, city: true } },
            },
          },
        },
      },
    },
  });
}
