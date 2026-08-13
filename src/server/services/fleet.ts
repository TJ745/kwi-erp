import "server-only";
import type { Prisma, VehicleStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import type {
  MaintenanceInput,
  VehicleHandoverInput,
  VehicleInput,
} from "@/lib/schemas/fleet";
import { nextVehicleCode } from "./counter";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Fleet management.
 *
 * A vehicle carries TWO independent expiry dates — registration and insurance —
 * so it feeds two projection rows (ExpirySource.VEHICLE_REGISTRATION and
 * VEHICLE_INSURANCE) keyed on the same vehicle id. Both surface on the
 * dashboard alongside Iqama, passport, and contract expiries.
 *
 * "One active driver per vehicle" is enforced by a partial unique index:
 *   CREATE UNIQUE INDEX vehicle_single_active_driver
 *     ON "VehicleAssignment" ("vehicleId") WHERE "unassignedAt" IS NULL;
 */

const SORTABLE = [
  "plateNumber",
  "make",
  "status",
  "registrationExpiry",
  "insuranceExpiry",
] as const;

export type VehicleListRow = {
  id: string;
  vehicleCode: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: VehicleStatus;
  companyCode: string;
  registrationExpiry: Date | null;
  insuranceExpiry: Date | null;
  currentDriverName: string | null;
  currentDriverId: string | null;
};

export async function listVehicles(
  ctx: ActorContext,
  query: ListQuery,
  filters: { status?: string | undefined } = {},
): Promise<Paginated<VehicleListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "plateNumber", direction: "asc" });

  const where: Prisma.VehicleWhereInput = {
    ...companyScopeWhere(ctx),
    ...(filters.status ? { status: filters.status as VehicleStatus } : {}),
    ...(query.q
      ? {
          OR: [
            { plateNumber: { contains: query.q, mode: "insensitive" } },
            { vehicleCode: { contains: query.q, mode: "insensitive" } },
            { make: { contains: query.q, mode: "insensitive" } },
            { model: { contains: query.q, mode: "insensitive" } },
            { vin: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const nullsLast = (field: string) =>
    field === "registrationExpiry" || field === "insuranceExpiry";

  const [rows, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: nullsLast(sort.field)
        ? { [sort.field]: { sort: sort.direction, nulls: "last" } }
        : { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        vehicleCode: true,
        plateNumber: true,
        make: true,
        model: true,
        year: true,
        status: true,
        registrationExpiry: true,
        insuranceExpiry: true,
        company: { select: { code: true } },
        currentDriver: { select: { id: true, fullName: true } },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return paginate(
    rows.map((v) => ({
      id: v.id,
      vehicleCode: v.vehicleCode,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      status: v.status,
      companyCode: v.company.code,
      registrationExpiry: v.registrationExpiry,
      insuranceExpiry: v.insuranceExpiry,
      currentDriverName: v.currentDriver?.fullName ?? null,
      currentDriverId: v.currentDriver?.id ?? null,
    })),
    total,
    query,
  );
}

export async function getVehicle(ctx: ActorContext, id: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      vehicleCode: true,
      plateNumber: true,
      plateNumberAr: true,
      make: true,
      model: true,
      year: true,
      color: true,
      vin: true,
      status: true,
      currentMileage: true,
      registrationNo: true,
      registrationExpiry: true,
      insurancePolicyNo: true,
      insuranceProvider: true,
      insuranceExpiry: true,
      notes: true,
      companyId: true,
      company: { select: { code: true, name: true } },
      currentDriver: { select: { id: true, fullName: true, employeeNo: true } },
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: 20,
        select: {
          id: true,
          assignedAt: true,
          unassignedAt: true,
          notes: true,
          employee: { select: { id: true, fullName: true, employeeNo: true } },
        },
      },
      maintenance: {
        orderBy: { date: "desc" },
        take: 20,
        select: {
          id: true,
          date: true,
          type: true,
          description: true,
          mileage: true,
          workshop: true,
          cost: true,
          currency: true,
          nextDueDate: true,
          nextDueMileage: true,
        },
      },
      handovers: {
        orderBy: { handoverDate: "desc" },
        take: 20,
        select: {
          id: true,
          handoverDate: true,
          mileage: true,
          fuelLevel: true,
          condition: true,
          remarks: true,
          fromEmployee: { select: { fullName: true } },
          toEmployee: { select: { fullName: true } },
        },
      },
    },
  });
  if (!vehicle) throw new NotFoundError("Vehicle not found.");
  return vehicle;
}

/**
 * Keeps both projection rows in step with the vehicle's two dates.
 * Clearing a date retires its row rather than leaving a stale reminder.
 */
async function syncVehicleExpiries(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  vehicle: {
    id: string;
    plateNumber: string;
    companyId: string;
    registrationExpiry: Date | null;
    insuranceExpiry: Date | null;
    status: VehicleStatus;
  },
): Promise<void> {
  // A sold or disposed vehicle should stop generating renewal reminders.
  const inService = vehicle.status !== "SOLD" && vehicle.status !== "DISPOSED";

  if (vehicle.registrationExpiry && inService) {
    await syncExpiry(
      {
        source: "VEHICLE_REGISTRATION",
        sourceId: vehicle.id,
        label: `Registration — ${vehicle.plateNumber}`,
        expiryDate: vehicle.registrationExpiry,
        companyId: vehicle.companyId,
        vehicleId: vehicle.id,
      },
      tx,
    );
  } else {
    await deactivateExpiry("VEHICLE_REGISTRATION", vehicle.id, tx);
  }

  if (vehicle.insuranceExpiry && inService) {
    await syncExpiry(
      {
        source: "VEHICLE_INSURANCE",
        sourceId: vehicle.id,
        label: `Insurance — ${vehicle.plateNumber}`,
        expiryDate: vehicle.insuranceExpiry,
        companyId: vehicle.companyId,
        vehicleId: vehicle.id,
      },
      tx,
    );
  } else {
    await deactivateExpiry("VEHICLE_INSURANCE", vehicle.id, tx);
  }
}

function vehicleData(input: VehicleInput) {
  return {
    companyId: input.companyId,
    plateNumber: input.plateNumber.toUpperCase(),
    plateNumberAr: input.plateNumberAr ?? null,
    make: input.make,
    model: input.model,
    year: input.year,
    color: input.color ?? null,
    vin: input.vin ? input.vin.toUpperCase() : null,
    status: input.status,
    currentMileage: input.currentMileage ?? null,
    registrationNo: input.registrationNo ?? null,
    registrationExpiry: input.registrationExpiry ?? null,
    insurancePolicyNo: input.insurancePolicyNo ?? null,
    insuranceProvider: input.insuranceProvider ?? null,
    insuranceExpiry: input.insuranceExpiry ?? null,
    notes: input.notes ?? null,
  };
}

export async function createVehicle(ctx: ActorContext, input: VehicleInput) {
  requireCompanyAccess(ctx, input.companyId);

  const plate = input.plateNumber.toUpperCase();
  const clash = await prisma.vehicle.findFirst({
    where: { plateNumber: plate },
    select: { vehicleCode: true },
  });
  if (clash) throw new ConflictError(`Plate ${plate} is already registered as ${clash.vehicleCode}.`);

  if (input.vin) {
    const vinClash = await prisma.vehicle.findFirst({
      where: { vin: input.vin.toUpperCase() },
      select: { vehicleCode: true },
    });
    if (vinClash) {
      throw new ConflictError(`That VIN is already recorded as ${vinClash.vehicleCode}.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const vehicleCode = await nextVehicleCode(tx);

    const vehicle = await tx.vehicle.create({
      data: { vehicleCode, ...vehicleData(input) },
      select: {
        id: true,
        vehicleCode: true,
        plateNumber: true,
        companyId: true,
        registrationExpiry: true,
        insuranceExpiry: true,
        status: true,
      },
    });

    await syncVehicleExpiries(tx, vehicle);
    return vehicle;
  });
}

export async function updateVehicle(ctx: ActorContext, input: VehicleInput & { id: string }) {
  const before = await getVehicle(ctx, input.id);
  requireCompanyAccess(ctx, input.companyId);

  const plate = input.plateNumber.toUpperCase();
  if (plate !== before.plateNumber) {
    const clash = await prisma.vehicle.findFirst({
      where: { plateNumber: plate, id: { not: input.id } },
      select: { vehicleCode: true },
    });
    if (clash) throw new ConflictError(`Plate ${plate} is already registered.`);
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicle.update({
      where: { id: input.id },
      data: vehicleData(input),
      select: {
        id: true,
        vehicleCode: true,
        plateNumber: true,
        companyId: true,
        registrationExpiry: true,
        insuranceExpiry: true,
        status: true,
      },
    });

    await syncVehicleExpiries(tx, updated);
    return updated;
  });

  return { before, after };
}

/** Driver assignment. The partial unique index guarantees one active driver. */
export async function assignDriver(
  ctx: ActorContext,
  input: { vehicleId: string; employeeId: string; notes?: string | undefined },
) {
  const vehicle = await getVehicle(ctx, input.vehicleId);

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");
  if (employee.companyId !== vehicle.companyId) {
    throw new ConflictError("The driver and the vehicle belong to different companies.");
  }

  if (vehicle.status === "SOLD" || vehicle.status === "DISPOSED") {
    throw new ConflictError(`A ${vehicle.status.toLowerCase()} vehicle cannot be assigned.`);
  }

  const open = vehicle.assignments.find((a) => a.unassignedAt === null);
  if (open) {
    throw new ConflictError(
      `${vehicle.plateNumber} is already assigned to ${open.employee.fullName}. Unassign first.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleAssignment.create({
      data: {
        vehicleId: input.vehicleId,
        employeeId: input.employeeId,
        assignedAt: new Date(),
        assignedById: ctx.userId,
        notes: input.notes ?? null,
      },
    });
    // Denormalised for fast list rendering; the assignment row is the record.
    await tx.vehicle.update({
      where: { id: input.vehicleId },
      data: { currentDriverId: input.employeeId },
    });
  });

  return {
    plateNumber: vehicle.plateNumber,
    employeeName: employee.fullName,
    companyId: vehicle.companyId,
  };
}

export async function unassignDriver(ctx: ActorContext, vehicleId: string) {
  const vehicle = await getVehicle(ctx, vehicleId);
  const open = vehicle.assignments.find((a) => a.unassignedAt === null);
  if (!open) throw new ConflictError(`${vehicle.plateNumber} has no assigned driver.`);

  await prisma.$transaction(async (tx) => {
    await tx.vehicleAssignment.update({
      where: { id: open.id },
      data: { unassignedAt: new Date() },
    });
    await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: null } });
  });

  return {
    plateNumber: vehicle.plateNumber,
    employeeName: open.employee.fullName,
    companyId: vehicle.companyId,
  };
}

export async function addMaintenance(ctx: ActorContext, input: MaintenanceInput) {
  const vehicle = await getVehicle(ctx, input.vehicleId);

  // Mileage should not go backwards; a typo here corrupts the service history.
  if (
    input.mileage !== undefined &&
    vehicle.currentMileage !== null &&
    input.mileage < vehicle.currentMileage
  ) {
    throw new ConflictError(
      `Mileage ${String(input.mileage)} is below the recorded ${String(vehicle.currentMileage)}.`,
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicleMaintenance.create({
      data: {
        vehicleId: input.vehicleId,
        date: input.date,
        type: input.type,
        description: input.description,
        mileage: input.mileage ?? null,
        workshop: input.workshop ?? null,
        cost: input.cost ?? null,
        nextDueDate: input.nextDueDate ?? null,
        nextDueMileage: input.nextDueMileage ?? null,
        notes: input.notes ?? null,
        createdById: ctx.userId,
      },
      select: { id: true, type: true, date: true },
    });

    if (input.mileage !== undefined) {
      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { currentMileage: input.mileage },
      });
    }

    return created;
  });

  return { record, plateNumber: vehicle.plateNumber, companyId: vehicle.companyId };
}

export async function recordHandover(ctx: ActorContext, input: VehicleHandoverInput) {
  const vehicle = await getVehicle(ctx, input.vehicleId);
  const currentDriverId = vehicle.currentDriver?.id ?? null;

  if (input.toEmployeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.toEmployeeId, ...companyScopeWhere(ctx) },
      select: { id: true, companyId: true },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
    if (employee.companyId !== vehicle.companyId) {
      throw new ConflictError("The receiving driver belongs to a different company.");
    }
  }

  const handover = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicleHandover.create({
      data: {
        vehicleId: input.vehicleId,
        fromEmployeeId: currentDriverId,
        toEmployeeId: input.toEmployeeId ?? null,
        handoverDate: input.handoverDate,
        mileage: input.mileage ?? null,
        fuelLevel: input.fuelLevel,
        condition: input.condition,
        ...(input.accessories ? { accessories: { items: input.accessories } } : {}),
        ...(input.damages ? { damages: { items: input.damages } } : {}),
        remarks: input.remarks ?? null,
        issuedById: ctx.userId,
      },
      select: { id: true },
    });

    // A handover IS the driver change: close the old assignment and open a new
    // one, so the two records can never disagree.
    const open = await tx.vehicleAssignment.findFirst({
      where: { vehicleId: input.vehicleId, unassignedAt: null },
      select: { id: true },
    });
    if (open) {
      await tx.vehicleAssignment.update({
        where: { id: open.id },
        data: { unassignedAt: input.handoverDate },
      });
    }

    if (input.toEmployeeId) {
      await tx.vehicleAssignment.create({
        data: {
          vehicleId: input.vehicleId,
          employeeId: input.toEmployeeId,
          assignedAt: input.handoverDate,
          assignedById: ctx.userId,
        },
      });
    }

    await tx.vehicle.update({
      where: { id: input.vehicleId },
      data: {
        currentDriverId: input.toEmployeeId ?? null,
        ...(input.mileage !== undefined ? { currentMileage: input.mileage } : {}),
      },
    });

    return created;
  });

  return { id: handover.id, plateNumber: vehicle.plateNumber, companyId: vehicle.companyId };
}

export type FleetCounts = {
  total: number;
  active: number;
  registrationDue: number;
  insuranceDue: number;
};

export async function fleetCounts(ctx: ActorContext): Promise<FleetCounts> {
  const scope = companyScopeWhere(ctx);
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [total, active, registrationDue, insuranceDue] = await Promise.all([
    prisma.vehicle.count({ where: scope }),
    prisma.vehicle.count({ where: { ...scope, status: "ACTIVE" } }),
    prisma.vehicle.count({ where: { ...scope, registrationExpiry: { lte: in30 } } }),
    prisma.vehicle.count({ where: { ...scope, insuranceExpiry: { lte: in30 } } }),
  ]);

  return { total, active, registrationDue, insuranceDue };
}

/** Maintenance across the fleet, for the maintenance page. */
export async function listMaintenance(ctx: ActorContext, query: ListQuery) {
  const where: Prisma.VehicleMaintenanceWhereInput = {
    vehicle: companyScopeWhere(ctx),
    ...(query.q
      ? {
          OR: [
            { description: { contains: query.q, mode: "insensitive" } },
            { workshop: { contains: query.q, mode: "insensitive" } },
            { vehicle: { plateNumber: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.vehicleMaintenance.findMany({
      where,
      orderBy: { date: "desc" },
      ...paginationFor(query),
      select: {
        id: true,
        date: true,
        type: true,
        description: true,
        mileage: true,
        workshop: true,
        cost: true,
        currency: true,
        nextDueDate: true,
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
      },
    }),
    prisma.vehicleMaintenance.count({ where }),
  ]);

  return paginate(rows, total, query);
}

export async function driverOptions(ctx: ActorContext, companyId: string) {
  requireCompanyAccess(ctx, companyId);
  return prisma.employee.findMany({
    where: { companyId, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, employeeNo: true },
  });
}

/**
 * Every handover across the fleet — brief §27.
 *
 * The per-vehicle tab answers "who has had this car"; this answers "what
 * changed hands this month", which is the question at fleet-review time.
 */
export async function listHandovers(
  ctx: ActorContext,
  filters: { vehicleId?: string | undefined; from?: Date | undefined; to?: Date | undefined } = {},
) {
  return prisma.vehicleHandover.findMany({
    where: {
      vehicle: { ...companyScopeWhere(ctx), deletedAt: null },
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.from || filters.to
        ? {
            handoverDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { handoverDate: "desc" },
    take: 300,
    select: {
      id: true,
      handoverDate: true,
      mileage: true,
      fuelLevel: true,
      condition: true,
      remarks: true,
      acknowledgedAt: true,
      documentId: true,
      vehicle: {
        select: {
          id: true,
          plateNumber: true,
          make: true,
          model: true,
          company: { select: { code: true } },
        },
      },
      fromEmployee: { select: { id: true, fullName: true } },
      toEmployee: { select: { id: true, fullName: true } },
    },
  });
}
