import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import type { CctvInput, IpPhoneInput } from "@/lib/schemas/infrastructure";

/** IT infrastructure: device IPs, IP phones, CCTV — all layered over IT assets. */

const UNIQUE_VIOLATION = "P2002";

/** Turns a unique-constraint violation into a sentence naming the field. */
function asConflict(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
    throw new ConflictError(message);
  }
  throw error;
}

// --- Device IPs --------------------------------------------------------------

/**
 * Every asset that has an IP address. Read-only: the address is edited on the
 * asset, so it is recorded in exactly one place.
 */
export async function listDeviceIps(ctx: ActorContext, filters: { q?: string | undefined } = {}) {
  const rows = await prisma.iTAsset.findMany({
    where: {
      ipAddress: { not: null },
      deletedAt: null,
      ...companyScopeWhere(ctx),
      ...(filters.q
        ? {
            OR: [
              { ipAddress: { contains: filters.q, mode: "insensitive" as const } },
              { assetCode: { contains: filters.q, mode: "insensitive" as const } },
              { brand: { contains: filters.q, mode: "insensitive" as const } },
              { model: { contains: filters.q, mode: "insensitive" as const } },
              { location: { contains: filters.q, mode: "insensitive" as const } },
              { macAddress: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    take: 5000,
    select: {
      id: true,
      assetCode: true,
      type: true,
      brand: true,
      model: true,
      ipAddress: true,
      macAddress: true,
      location: true,
      status: true,
      company: { select: { code: true } },
      assignments: {
        where: { returnedAt: null },
        take: 1,
        select: { employee: { select: { fullName: true, employeeNo: true } } },
      },
    },
  });

  // Sorted numerically (10.0.0.9 before 10.0.0.10), which the database's text
  // ordering would get wrong.
  return rows
    .map((r) => ({
      id: r.id,
      assetCode: r.assetCode,
      type: r.type,
      device: `${r.brand} ${r.model}`,
      ipAddress: r.ipAddress ?? "",
      macAddress: r.macAddress,
      location: r.location,
      status: r.status,
      companyCode: r.company.code,
      holder: r.assignments[0]?.employee ?? null,
    }))
    .sort((a, b) => compareIp(a.ipAddress, b.ipAddress));
}

function compareIp(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  if (pa.length === 4 && pb.length === 4 && [...pa, ...pb].every(Number.isFinite)) {
    for (let k = 0; k < 4; k++) {
      const diff = (pa[k] ?? 0) - (pb[k] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
  return a.localeCompare(b);
}

// --- IP phones ---------------------------------------------------------------

/** The handset fields shown with an extension, all read from the asset. */
const HANDSET_SELECT = {
  id: true,
  assetCode: true,
  brand: true,
  model: true,
  macAddress: true,
  location: true,
  status: true,
  deletedAt: true,
  company: { select: { code: true } },
  // The open handover, if any, is who holds the handset today.
  assignments: {
    where: { returnedAt: null },
    take: 1,
    select: { employee: { select: { id: true, fullName: true, employeeNo: true } } },
  },
} as const;

export async function listIpPhones(ctx: ActorContext, filters: { q?: string | undefined } = {}) {
  const rows = await prisma.ipPhone.findMany({
    // A phone belongs to the company that owns its handset.
    where: {
      asset: companyScopeWhere(ctx),
      ...(filters.q
        ? {
            OR: [
              { extension: { contains: filters.q } },
              { asset: { assetCode: { contains: filters.q, mode: "insensitive" as const } } },
              { asset: { macAddress: { contains: filters.q, mode: "insensitive" as const } } },
              { asset: { model: { contains: filters.q, mode: "insensitive" as const } } },
              { asset: { location: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { extension: "asc" },
    select: { id: true, extension: true, assetId: true, asset: { select: HANDSET_SELECT } },
  });

  return rows.map((r) => ({
    id: r.id,
    extension: r.extension,
    assetId: r.assetId,
    handset: {
      id: r.asset.id,
      assetCode: r.asset.assetCode,
      label: `${r.asset.brand} ${r.asset.model}`,
      macAddress: r.asset.macAddress,
      location: r.asset.location,
      status: r.asset.status,
      removed: r.asset.deletedAt !== null,
      companyCode: r.asset.company.code,
    },
    holder: r.asset.assignments[0]?.employee ?? null,
  }));
}

/**
 * IP-phone assets for the picker, each marked with the extension already on
 * it. The dialog offers only free handsets, plus the one an entry already uses.
 */
export async function ipPhoneHandsetOptions(ctx: ActorContext) {
  const assets = await prisma.iTAsset.findMany({
    where: {
      type: "IP_PHONE",
      deletedAt: null,
      status: { notIn: ["DISPOSED", "LOST"] },
      ...companyScopeWhere(ctx),
    },
    orderBy: { assetCode: "asc" },
    select: {
      id: true,
      assetCode: true,
      brand: true,
      model: true,
      location: true,
      ipPhone: { select: { id: true } },
    },
  });
  return assets.map((a) => ({
    id: a.id,
    label: `${a.assetCode} · ${a.brand} ${a.model}${a.location ? ` · ${a.location}` : ""}`,
    usedByPhoneId: a.ipPhone?.id ?? null,
  }));
}

/** The handset must be an IP-phone asset the actor can see. */
async function requireHandset(ctx: ActorContext, assetId: string) {
  const asset = await prisma.iTAsset.findFirst({
    where: { id: assetId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      type: true,
      assetCode: true,
      ipPhone: { select: { id: true, extension: true } },
    },
  });
  if (!asset) throw new NotFoundError("Handset not found.");
  if (asset.type !== "IP_PHONE") {
    throw new ConflictError(
      `${asset.assetCode} is not an IP phone. Set its type to IP Phone in Assets first.`,
    );
  }
  return asset;
}

export async function createIpPhone(ctx: ActorContext, input: IpPhoneInput) {
  const handset = await requireHandset(ctx, input.assetId);
  if (handset.ipPhone) {
    throw new ConflictError(
      `${handset.assetCode} already rings on extension ${handset.ipPhone.extension}.`,
    );
  }

  try {
    return await prisma.ipPhone.create({
      data: { extension: input.extension, assetId: input.assetId },
      select: { id: true, extension: true, asset: { select: { assetCode: true } } },
    });
  } catch (error) {
    asConflict(error, `Extension ${input.extension} is already in use.`);
  }
}

export async function updateIpPhone(ctx: ActorContext, input: IpPhoneInput & { id: string }) {
  const before = await prisma.ipPhone.findFirst({
    where: { id: input.id, asset: companyScopeWhere(ctx) },
    select: { id: true, extension: true, asset: { select: { assetCode: true } } },
  });
  if (!before) throw new NotFoundError("Phone not found.");

  const handset = await requireHandset(ctx, input.assetId);
  if (handset.ipPhone && handset.ipPhone.id !== input.id) {
    throw new ConflictError(
      `${handset.assetCode} already rings on extension ${handset.ipPhone.extension}.`,
    );
  }

  try {
    const after = await prisma.ipPhone.update({
      where: { id: input.id },
      data: { extension: input.extension, assetId: input.assetId },
      select: { id: true, extension: true, asset: { select: { assetCode: true } } },
    });
    return {
      before: { extension: before.extension, handset: before.asset.assetCode },
      after: { id: after.id, extension: after.extension, handset: after.asset.assetCode },
    };
  } catch (error) {
    asConflict(error, `Extension ${input.extension} is already in use.`);
  }
}

export async function deleteIpPhone(ctx: ActorContext, id: string) {
  const phone = await prisma.ipPhone.findFirst({
    where: { id, asset: companyScopeWhere(ctx) },
    select: { id: true, extension: true },
  });
  if (!phone) throw new NotFoundError("Phone not found.");
  await prisma.ipPhone.delete({ where: { id } });
  return phone;
}

// --- CCTV --------------------------------------------------------------------

const RECORDER_CCTV_TYPES = new Set(["NVR", "DVR"]);

/** The device fields shown on the CCTV page, all read from the asset. */
const CCTV_ASSET_SELECT = {
  id: true,
  assetCode: true,
  brand: true,
  model: true,
  location: true,
  ipAddress: true,
  status: true,
  deletedAt: true,
  companyId: true,
  company: { select: { code: true } },
} as const;

export async function listCctv(ctx: ActorContext) {
  const rows = await prisma.cctvDevice.findMany({
    // A CCTV device belongs to the company that owns its asset.
    where: { asset: companyScopeWhere(ctx) },
    orderBy: [{ type: "asc" }, { asset: { location: "asc" } }],
    select: {
      id: true,
      type: true,
      lastMaintenanceAt: true,
      notes: true,
      assetId: true,
      recorderId: true,
      asset: { select: CCTV_ASSET_SELECT },
      recorder: { select: { id: true, asset: { select: { assetCode: true, location: true } } } },
      _count: { select: { cameras: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    lastMaintenanceAt: r.lastMaintenanceAt,
    notes: r.notes,
    assetId: r.assetId,
    recorderId: r.recorderId,
    device: {
      id: r.asset.id,
      assetCode: r.asset.assetCode,
      label: `${r.asset.brand} ${r.asset.model}`,
      location: r.asset.location,
      ipAddress: r.asset.ipAddress,
      status: r.asset.status,
      removed: r.asset.deletedAt !== null,
      companyCode: r.asset.company.code,
    },
    recorder: r.recorder
      ? {
          id: r.recorder.id,
          label: `${r.recorder.asset.assetCode}${r.recorder.asset.location ? ` · ${r.recorder.asset.location}` : ""}`,
        }
      : null,
    cameraCount: r._count.cameras,
  }));
}

/**
 * Camera and recorder assets for the picker, each marked with the CCTV entry
 * already using it, so the dialog can offer only free ones.
 */
export async function cctvAssetOptions(ctx: ActorContext) {
  const assets = await prisma.iTAsset.findMany({
    where: {
      type: { in: ["CCTV_CAMERA", "CCTV_RECORDER"] },
      deletedAt: null,
      status: { notIn: ["DISPOSED", "LOST"] },
      ...companyScopeWhere(ctx),
    },
    orderBy: { assetCode: "asc" },
    select: {
      id: true,
      assetCode: true,
      type: true,
      brand: true,
      model: true,
      location: true,
      cctv: { select: { id: true } },
    },
  });
  return assets.map((a) => ({
    id: a.id,
    kind: a.type === "CCTV_RECORDER" ? ("recorder" as const) : ("camera" as const),
    label: `${a.assetCode} · ${a.brand} ${a.model}${a.location ? ` · ${a.location}` : ""}`,
    usedByCctvId: a.cctv?.id ?? null,
  }));
}

/** The asset must be visible, and its type must match the CCTV type chosen. */
async function requireCctvAsset(ctx: ActorContext, assetId: string, cctvType: string) {
  const asset = await prisma.iTAsset.findFirst({
    where: { id: assetId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      type: true,
      assetCode: true,
      companyId: true,
      cctv: { select: { id: true, type: true } },
    },
  });
  if (!asset) throw new NotFoundError("Device not found in Assets.");

  const wantsRecorder = RECORDER_CCTV_TYPES.has(cctvType);
  const needed = wantsRecorder ? "CCTV_RECORDER" : "CCTV_CAMERA";
  if (asset.type !== needed) {
    throw new ConflictError(
      wantsRecorder
        ? `${asset.assetCode} is not a recorder. An NVR or DVR must be an asset of type CCTV Recorder.`
        : `${asset.assetCode} is not a camera. A ${cctvType} camera must be an asset of type CCTV Camera.`,
    );
  }
  return asset;
}

async function requireRecorder(
  ctx: ActorContext,
  recorderId: string,
  companyId: string,
  selfId?: string,
) {
  if (recorderId === selfId) throw new ConflictError("A device cannot record itself.");
  const recorder = await prisma.cctvDevice.findFirst({
    where: { id: recorderId, asset: companyScopeWhere(ctx) },
    select: { id: true, type: true, asset: { select: { assetCode: true, companyId: true } } },
  });
  if (!recorder) throw new NotFoundError("Recorder not found.");
  if (!RECORDER_CCTV_TYPES.has(recorder.type)) {
    throw new ConflictError(`${recorder.asset.assetCode} is a camera, not a recorder.`);
  }
  if (recorder.asset.companyId !== companyId) {
    throw new ConflictError("The recorder belongs to a different company.");
  }
}

export async function createCctv(ctx: ActorContext, input: CctvInput) {
  const asset = await requireCctvAsset(ctx, input.assetId, input.type);
  if (asset.cctv) {
    throw new ConflictError(`${asset.assetCode} is already on the CCTV page.`);
  }
  if (input.recorderId) await requireRecorder(ctx, input.recorderId, asset.companyId);

  const created = await prisma.cctvDevice.create({
    data: {
      assetId: input.assetId,
      type: input.type,
      recorderId: input.recorderId ?? null,
      lastMaintenanceAt: input.lastMaintenanceAt ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, type: true },
  });
  return { ...created, assetCode: asset.assetCode, companyId: asset.companyId };
}

export async function updateCctv(ctx: ActorContext, input: CctvInput & { id: string }) {
  const before = await prisma.cctvDevice.findFirst({
    where: { id: input.id, asset: companyScopeWhere(ctx) },
    select: {
      id: true,
      type: true,
      recorderId: true,
      asset: { select: { assetCode: true } },
      _count: { select: { cameras: true } },
    },
  });
  if (!before) throw new NotFoundError("Device not found.");

  const asset = await requireCctvAsset(ctx, input.assetId, input.type);
  if (asset.cctv && asset.cctv.id !== input.id) {
    throw new ConflictError(`${asset.assetCode} is already on the CCTV page.`);
  }

  // Demoting a recorder that still has cameras would orphan them.
  if (!RECORDER_CCTV_TYPES.has(input.type) && before._count.cameras > 0) {
    throw new ConflictError(
      `${before.asset.assetCode} has ${String(before._count.cameras)} camera(s) attached. Reassign them before changing its type.`,
    );
  }
  if (input.recorderId) await requireRecorder(ctx, input.recorderId, asset.companyId, input.id);

  const after = await prisma.cctvDevice.update({
    where: { id: input.id },
    data: {
      assetId: input.assetId,
      type: input.type,
      recorderId: input.recorderId ?? null,
      lastMaintenanceAt: input.lastMaintenanceAt ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, type: true, recorderId: true },
  });

  return {
    before: { type: before.type, device: before.asset.assetCode, recorderId: before.recorderId },
    after: { ...after, device: asset.assetCode, companyId: asset.companyId },
  };
}

export async function deleteCctv(ctx: ActorContext, id: string) {
  const device = await prisma.cctvDevice.findFirst({
    where: { id, asset: companyScopeWhere(ctx) },
    select: {
      id: true,
      asset: { select: { assetCode: true, companyId: true } },
      _count: { select: { cameras: true } },
    },
  });
  if (!device) throw new NotFoundError("Device not found.");
  if (device._count.cameras > 0) {
    throw new ConflictError(
      `${String(device._count.cameras)} camera(s) record to this device. Reassign them first.`,
    );
  }

  await prisma.cctvDevice.delete({ where: { id } });
  return { id: device.id, assetCode: device.asset.assetCode, companyId: device.asset.companyId };
}
