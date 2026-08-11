import "server-only";
import type { AssetStatus, Prisma } from "@/generated/prisma/client";
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
import type { AssetInput } from "@/lib/schemas/it";
import { nextAssetCode } from "./counter";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * IT assets and their handover lifecycle.
 *
 * "An asset cannot be assigned to two employees simultaneously" (brief §50) is
 * enforced by a PARTIAL UNIQUE INDEX in the database:
 *
 *   CREATE UNIQUE INDEX it_asset_single_active_assignment
 *     ON "ITAssetAssignment" ("assetId") WHERE "returnedAt" IS NULL;
 *
 * The check below is for a friendly message; the index is what makes the rule
 * true under concurrency.
 */

const SORTABLE = ["assetCode", "brand", "status", "warrantyExpiry", "createdAt"] as const;

export type AssetListRow = {
  id: string;
  assetCode: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  status: AssetStatus;
  condition: string;
  warrantyExpiry: Date | null;
  companyCode: string;
  assignedToName: string | null;
  assignedToId: string | null;
};

export async function listAssets(
  ctx: ActorContext,
  query: ListQuery,
  filters: { status?: string | undefined; type?: string | undefined } = {},
): Promise<Paginated<AssetListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "assetCode", direction: "asc" });

  const where: Prisma.ITAssetWhereInput = {
    ...companyScopeWhere(ctx),
    ...(filters.status ? { status: filters.status as AssetStatus } : {}),
    ...(filters.type ? { type: filters.type as "LAPTOP" } : {}),
    ...(query.q
      ? {
          OR: [
            { assetCode: { contains: query.q, mode: "insensitive" } },
            { serialNumber: { contains: query.q, mode: "insensitive" } },
            { brand: { contains: query.q, mode: "insensitive" } },
            { model: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.iTAsset.findMany({
      where,
      orderBy:
        sort.field === "warrantyExpiry"
          ? { warrantyExpiry: { sort: sort.direction, nulls: "last" } }
          : { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        assetCode: true,
        type: true,
        brand: true,
        model: true,
        serialNumber: true,
        status: true,
        condition: true,
        warrantyExpiry: true,
        company: { select: { code: true } },
        // The current holder is the one open assignment, if any.
        assignments: {
          where: { returnedAt: null },
          take: 1,
          select: { employeeId: true, employee: { select: { fullName: true } } },
        },
      },
    }),
    prisma.iTAsset.count({ where }),
  ]);

  return paginate(
    rows.map((a) => {
      const open = a.assignments[0];
      return {
        id: a.id,
        assetCode: a.assetCode,
        type: a.type,
        brand: a.brand,
        model: a.model,
        serialNumber: a.serialNumber,
        status: a.status,
        condition: a.condition,
        warrantyExpiry: a.warrantyExpiry,
        companyCode: a.company.code,
        assignedToName: open?.employee.fullName ?? null,
        assignedToId: open?.employeeId ?? null,
      };
    }),
    total,
    query,
  );
}

export async function getAsset(ctx: ActorContext, id: string) {
  const asset = await prisma.iTAsset.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      assetCode: true,
      assetTag: true,
      type: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      condition: true,
      location: true,
      notes: true,
      purchaseDate: true,
      purchaseCost: true,
      currency: true,
      warrantyExpiry: true,
      companyId: true,
      company: { select: { code: true, name: true } },
      assignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true,
          assignedAt: true,
          returnedAt: true,
          conditionOut: true,
          conditionIn: true,
          accessoriesOut: true,
          missingAccessories: true,
          remarksOut: true,
          remarksIn: true,
          employee: { select: { id: true, fullName: true, employeeNo: true } },
        },
      },
    },
  });
  if (!asset) throw new NotFoundError("Asset not found.");
  return asset;
}

export async function createAsset(ctx: ActorContext, input: AssetInput) {
  requireCompanyAccess(ctx, input.companyId);

  if (input.serialNumber) {
    const clash = await prisma.iTAsset.findFirst({
      where: { serialNumber: input.serialNumber },
      select: { id: true, assetCode: true },
    });
    if (clash) {
      throw new ConflictError(`That serial number is already recorded as ${clash.assetCode}.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const assetCode = await nextAssetCode(tx);

    const asset = await tx.iTAsset.create({
      data: {
        assetCode,
        assetTag: input.assetTag ?? null,
        companyId: input.companyId,
        type: input.type,
        brand: input.brand,
        model: input.model,
        serialNumber: input.serialNumber ?? null,
        purchaseDate: input.purchaseDate ?? null,
        purchaseCost: input.purchaseCost ?? null,
        warrantyExpiry: input.warrantyExpiry ?? null,
        condition: input.condition,
        location: input.location ?? null,
        notes: input.notes ?? null,
        status: "AVAILABLE",
      },
      select: { id: true, assetCode: true, brand: true, model: true, companyId: true },
    });

    if (input.warrantyExpiry) {
      await syncExpiry(
        {
          source: "IT_ASSET_WARRANTY",
          sourceId: asset.id,
          label: `Warranty — ${asset.assetCode} ${asset.brand} ${asset.model}`,
          expiryDate: input.warrantyExpiry,
          companyId: asset.companyId,
        },
        tx,
      );
    }

    return asset;
  });
}

export async function updateAsset(ctx: ActorContext, input: AssetInput & { id: string }) {
  const before = await getAsset(ctx, input.id);
  requireCompanyAccess(ctx, input.companyId);

  if (input.serialNumber && input.serialNumber !== before.serialNumber) {
    const clash = await prisma.iTAsset.findFirst({
      where: { serialNumber: input.serialNumber, id: { not: input.id } },
      select: { assetCode: true },
    });
    if (clash) {
      throw new ConflictError(`That serial number is already recorded as ${clash.assetCode}.`);
    }
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.iTAsset.update({
      where: { id: input.id },
      data: {
        assetTag: input.assetTag ?? null,
        companyId: input.companyId,
        type: input.type,
        brand: input.brand,
        model: input.model,
        serialNumber: input.serialNumber ?? null,
        purchaseDate: input.purchaseDate ?? null,
        purchaseCost: input.purchaseCost ?? null,
        warrantyExpiry: input.warrantyExpiry ?? null,
        condition: input.condition,
        location: input.location ?? null,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        assetCode: true,
        brand: true,
        model: true,
        companyId: true,
        warrantyExpiry: true,
      },
    });

    if (updated.warrantyExpiry) {
      await syncExpiry(
        {
          source: "IT_ASSET_WARRANTY",
          sourceId: updated.id,
          label: `Warranty — ${updated.assetCode} ${updated.brand} ${updated.model}`,
          expiryDate: updated.warrantyExpiry,
          companyId: updated.companyId,
        },
        tx,
      );
    } else {
      await deactivateExpiry("IT_ASSET_WARRANTY", updated.id, tx);
    }

    return updated;
  });

  return { before, after };
}

/** Handover-out. */
export async function assignAsset(
  ctx: ActorContext,
  input: {
    assetId: string;
    employeeId: string;
    conditionOut: "NEW" | "GOOD" | "FAIR" | "POOR" | "DAMAGED";
    accessories?: string | undefined;
    remarks?: string | undefined;
  },
) {
  const asset = await getAsset(ctx, input.assetId);

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true, status: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  if (employee.companyId !== asset.companyId) {
    throw new ConflictError("The asset and the employee belong to different companies.");
  }

  // Friendly message; the partial unique index is the real guarantee.
  const open = asset.assignments.find((a) => a.returnedAt === null);
  if (open) {
    throw new ConflictError(
      `${asset.assetCode} is already issued to ${open.employee.fullName}. Record its return first.`,
    );
  }

  if (asset.status === "DISPOSED" || asset.status === "LOST" || asset.status === "RETIRED") {
    throw new ConflictError(`A ${asset.status.toLowerCase()} asset cannot be issued.`);
  }

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.iTAssetAssignment.create({
      data: {
        assetId: input.assetId,
        employeeId: input.employeeId,
        assignedAt: new Date(),
        assignedById: ctx.userId,
        conditionOut: input.conditionOut,
        // Key omitted entirely when absent — a Json column under
        // exactOptionalPropertyTypes will not accept an explicit `undefined`.
        ...(input.accessories ? { accessoriesOut: { items: input.accessories } } : {}),
        remarksOut: input.remarks ?? null,
      },
      select: { id: true },
    });

    await tx.iTAsset.update({
      where: { id: input.assetId },
      data: { status: "ASSIGNED" },
    });

    return {
      assignmentId: assignment.id,
      assetCode: asset.assetCode,
      employeeName: employee.fullName,
      companyId: asset.companyId,
    };
  });
}

/** Handover-in. */
export async function returnAsset(
  ctx: ActorContext,
  input: {
    assetId: string;
    conditionIn: "NEW" | "GOOD" | "FAIR" | "POOR" | "DAMAGED";
    missingAccessories?: string | undefined;
    remarks?: string | undefined;
    nextStatus: "AVAILABLE" | "UNDER_REPAIR" | "LOST" | "RETIRED";
  },
) {
  const asset = await getAsset(ctx, input.assetId);
  const open = asset.assignments.find((a) => a.returnedAt === null);
  if (!open) throw new ConflictError(`${asset.assetCode} is not currently issued to anyone.`);

  return prisma.$transaction(async (tx) => {
    await tx.iTAssetAssignment.update({
      where: { id: open.id },
      data: {
        returnedAt: new Date(),
        receivedById: ctx.userId,
        conditionIn: input.conditionIn,
        ...(input.missingAccessories
          ? { missingAccessories: { items: input.missingAccessories } }
          : {}),
        remarksIn: input.remarks ?? null,
      },
    });

    // Damaged or missing kit does not silently rejoin the available pool.
    await tx.iTAsset.update({
      where: { id: input.assetId },
      data: { status: input.nextStatus, condition: input.conditionIn },
    });

    return {
      assetCode: asset.assetCode,
      employeeName: open.employee.fullName,
      companyId: asset.companyId,
      nextStatus: input.nextStatus,
    };
  });
}

export type AssetCounts = {
  total: number;
  available: number;
  assigned: number;
  underRepair: number;
};

export async function assetCounts(ctx: ActorContext): Promise<AssetCounts> {
  const scope = companyScopeWhere(ctx);

  const [total, available, assigned, underRepair] = await Promise.all([
    prisma.iTAsset.count({ where: scope }),
    prisma.iTAsset.count({ where: { ...scope, status: "AVAILABLE" } }),
    prisma.iTAsset.count({ where: { ...scope, status: "ASSIGNED" } }),
    prisma.iTAsset.count({ where: { ...scope, status: "UNDER_REPAIR" } }),
  ]);

  return { total, available, assigned, underRepair };
}

/** Assets currently held by one employee — profile tab and offboarding. */
export async function assetsForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.iTAssetAssignment.findMany({
    where: { employeeId, asset: companyScopeWhere(ctx) },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      assignedAt: true,
      returnedAt: true,
      conditionOut: true,
      conditionIn: true,
      asset: {
        select: { id: true, assetCode: true, type: true, brand: true, model: true },
      },
    },
  });
}

/** Employees eligible to receive an asset in a given company. */
export async function assignableEmployees(ctx: ActorContext, companyId: string) {
  requireCompanyAccess(ctx, companyId);
  return prisma.employee.findMany({
    where: { companyId, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, employeeNo: true },
  });
}
