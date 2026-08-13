import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { deactivateExpiry, syncExpiry } from "./expiry";
import type {
  AdRecordInput,
  CctvInput,
  IpAddressInput,
  IpPhoneInput,
  LicenceInput,
  NetworkDeviceInput,
  ServerInput,
} from "@/lib/schemas/infrastructure";

/**
 * IT infrastructure — brief §24–§26.
 *
 * Two schema comments govern this module and are worth restating:
 *
 *   SoftwareLicense — "Licence keys are never stored here — they reference a
 *   Credential row." There is no key column and no key field in the schema;
 *   a licence points at the vault (docs/SECURITY.md §5).
 *
 *   AdRecord — "Deliberately stores no credentials." It is directory metadata:
 *   account name, OU, groups, enabled. Never a password.
 */

const UNIQUE_VIOLATION = "P2002";

/** Turns a unique-constraint violation into a sentence naming the field. */
function asConflict(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  ) {
    throw new ConflictError(message);
  }
  throw error;
}

// --- Servers -----------------------------------------------------------------

export async function listServers(
  ctx: ActorContext,
  filters: { q?: string | undefined; status?: string | undefined } = {},
) {
  return prisma.server.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { ipAddress: { contains: filters.q, mode: "insensitive" as const } },
              { role: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ipAddress: true,
      os: true,
      role: true,
      location: true,
      cpuSpec: true,
      ramGb: true,
      storageGb: true,
      status: true,
      notes: true,
      companyId: true,
      company: { select: { code: true } },
    },
  });
}

export async function createServer(ctx: ActorContext, input: ServerInput) {
  requireCompanyAccess(ctx, input.companyId);
  try {
    return await prisma.server.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        ipAddress: input.ipAddress ?? null,
        os: input.os ?? null,
        role: input.role ?? null,
        location: input.location ?? null,
        cpuSpec: input.cpuSpec ?? null,
        ramGb: input.ramGb ?? null,
        storageGb: input.storageGb ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
      select: { id: true, name: true, companyId: true, ipAddress: true },
    });
  } catch (error) {
    asConflict(error, `A server named "${input.name}" already exists.`);
  }
}

export async function updateServer(ctx: ActorContext, input: ServerInput & { id: string }) {
  const before = await prisma.server.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, name: true, ipAddress: true, status: true, companyId: true },
  });
  if (!before) throw new NotFoundError("Server not found.");
  requireCompanyAccess(ctx, input.companyId);

  try {
    const after = await prisma.server.update({
      where: { id: input.id },
      data: {
        companyId: input.companyId,
        name: input.name,
        ipAddress: input.ipAddress ?? null,
        os: input.os ?? null,
        role: input.role ?? null,
        location: input.location ?? null,
        cpuSpec: input.cpuSpec ?? null,
        ramGb: input.ramGb ?? null,
        storageGb: input.storageGb ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
      select: { id: true, name: true, ipAddress: true, status: true, companyId: true },
    });
    return { before, after };
  } catch (error) {
    asConflict(error, `A server named "${input.name}" already exists.`);
  }
}

export async function deleteServer(ctx: ActorContext, id: string) {
  const server = await prisma.server.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: { id: true, name: true, companyId: true },
  });
  if (!server) throw new NotFoundError("Server not found.");
  await prisma.server.delete({ where: { id } });
  return server;
}

// --- Network devices and IP addresses ----------------------------------------

export async function listNetworkDevices(
  ctx: ActorContext,
  filters: { q?: string | undefined } = {},
) {
  return prisma.networkDevice.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { ipAddress: { contains: filters.q, mode: "insensitive" as const } },
              { macAddress: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      model: true,
      ipAddress: true,
      macAddress: true,
      location: true,
      vlan: true,
      portCount: true,
      status: true,
      notes: true,
      companyId: true,
      company: { select: { code: true } },
      _count: { select: { ipAddresses: true } },
    },
  });
}

export async function createNetworkDevice(ctx: ActorContext, input: NetworkDeviceInput) {
  requireCompanyAccess(ctx, input.companyId);
  return prisma.networkDevice.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      type: input.type,
      model: input.model ?? null,
      ipAddress: input.ipAddress ?? null,
      macAddress: input.macAddress ?? null,
      location: input.location ?? null,
      vlan: input.vlan ?? null,
      portCount: input.portCount ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, type: true, companyId: true },
  });
}

export async function updateNetworkDevice(
  ctx: ActorContext,
  input: NetworkDeviceInput & { id: string },
) {
  const before = await prisma.networkDevice.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, name: true, ipAddress: true, status: true, companyId: true },
  });
  if (!before) throw new NotFoundError("Device not found.");
  requireCompanyAccess(ctx, input.companyId);

  const after = await prisma.networkDevice.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      name: input.name,
      type: input.type,
      model: input.model ?? null,
      ipAddress: input.ipAddress ?? null,
      macAddress: input.macAddress ?? null,
      location: input.location ?? null,
      vlan: input.vlan ?? null,
      portCount: input.portCount ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, ipAddress: true, status: true, companyId: true },
  });

  return { before, after };
}

export async function deleteNetworkDevice(ctx: ActorContext, id: string) {
  const device = await prisma.networkDevice.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      companyId: true,
      _count: { select: { ipAddresses: true } },
    },
  });
  if (!device) throw new NotFoundError("Device not found.");
  if (device._count.ipAddresses > 0) {
    throw new ConflictError(
      `${device._count.ipAddresses} IP address(es) are assigned to this device. Reassign them first.`,
    );
  }

  await prisma.networkDevice.delete({ where: { id } });
  return device;
}

/**
 * IP addresses are globally unique in the schema, and deliberately not company
 * scoped: an address collision is a network fact, not an org-chart one, and
 * scoping the check would let two companies both claim 10.0.0.5.
 */
export async function listIpAddresses(
  ctx: ActorContext,
  filters: { q?: string | undefined } = {},
) {
  const devices = await prisma.networkDevice.findMany({
    where: { ...companyScopeWhere(ctx) },
    select: { id: true },
  });
  const deviceIds = devices.map((d) => d.id);

  return prisma.ipAddress.findMany({
    where: {
      // Unassigned addresses are visible to everyone; assigned ones follow
      // their device's company.
      OR: [{ deviceId: null }, { deviceId: { in: deviceIds } }],
      ...(filters.q
        ? {
            OR: [
              { address: { contains: filters.q, mode: "insensitive" as const } },
              { assignedTo: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { address: "asc" },
    take: 1000,
    select: {
      id: true,
      address: true,
      subnet: true,
      assignedTo: true,
      isStatic: true,
      notes: true,
      deviceId: true,
      device: { select: { id: true, name: true, company: { select: { code: true } } } },
    },
  });
}

export async function createIpAddress(ctx: ActorContext, input: IpAddressInput) {
  if (input.deviceId) {
    const device = await prisma.networkDevice.findFirst({
      where: { id: input.deviceId, ...companyScopeWhere(ctx) },
      select: { id: true },
    });
    if (!device) throw new NotFoundError("Device not found.");
  }

  try {
    return await prisma.ipAddress.create({
      data: {
        address: input.address,
        subnet: input.subnet ?? null,
        assignedTo: input.assignedTo ?? null,
        deviceId: input.deviceId ?? null,
        isStatic: input.isStatic,
        notes: input.notes ?? null,
      },
      select: { id: true, address: true, deviceId: true },
    });
  } catch (error) {
    // Two devices on one address is the classic cause of an outage nobody
    // can explain, so the message says what is already using it.
    asConflict(error, `${input.address} is already recorded.`);
  }
}

export async function updateIpAddress(
  ctx: ActorContext,
  input: IpAddressInput & { id: string },
) {
  const before = await prisma.ipAddress.findUnique({
    where: { id: input.id },
    select: { id: true, address: true, deviceId: true, assignedTo: true },
  });
  if (!before) throw new NotFoundError("Address not found.");

  if (input.deviceId) {
    const device = await prisma.networkDevice.findFirst({
      where: { id: input.deviceId, ...companyScopeWhere(ctx) },
      select: { id: true },
    });
    if (!device) throw new NotFoundError("Device not found.");
  }

  try {
    const after = await prisma.ipAddress.update({
      where: { id: input.id },
      data: {
        address: input.address,
        subnet: input.subnet ?? null,
        assignedTo: input.assignedTo ?? null,
        deviceId: input.deviceId ?? null,
        isStatic: input.isStatic,
        notes: input.notes ?? null,
      },
      select: { id: true, address: true, deviceId: true, assignedTo: true },
    });
    return { before, after };
  } catch (error) {
    asConflict(error, `${input.address} is already recorded.`);
  }
}

export async function deleteIpAddress(_ctx: ActorContext, id: string) {
  const address = await prisma.ipAddress.findUnique({
    where: { id },
    select: { id: true, address: true },
  });
  if (!address) throw new NotFoundError("Address not found.");
  await prisma.ipAddress.delete({ where: { id } });
  return address;
}

// --- IP phones ---------------------------------------------------------------

export async function listIpPhones(
  ctx: ActorContext,
  filters: { q?: string | undefined } = {},
) {
  return prisma.ipPhone.findMany({
    where: {
      // A phone reaches a company through its employee; unassigned handsets
      // are pool stock and visible to everyone.
      OR: [{ employeeId: null }, { employee: { ...companyScopeWhere(ctx) } }],
      ...(filters.q
        ? {
            OR: [
              { extension: { contains: filters.q } },
              { macAddress: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { extension: "asc" },
    select: {
      id: true,
      extension: true,
      deviceModel: true,
      macAddress: true,
      location: true,
      status: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeNo: true,
          company: { select: { code: true } },
        },
      },
    },
  });
}

export async function createIpPhone(ctx: ActorContext, input: IpPhoneInput) {
  if (input.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
  }

  try {
    return await prisma.ipPhone.create({
      data: {
        extension: input.extension,
        employeeId: input.employeeId ?? null,
        deviceModel: input.deviceModel ?? null,
        macAddress: input.macAddress ?? null,
        location: input.location ?? null,
        status: input.status,
      },
      select: { id: true, extension: true, employeeId: true },
    });
  } catch (error) {
    asConflict(error, `Extension ${input.extension} is already in use.`);
  }
}

export async function updateIpPhone(
  ctx: ActorContext,
  input: IpPhoneInput & { id: string },
) {
  const before = await prisma.ipPhone.findUnique({
    where: { id: input.id },
    select: { id: true, extension: true, employeeId: true, status: true },
  });
  if (!before) throw new NotFoundError("Phone not found.");

  if (input.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
  }

  try {
    const after = await prisma.ipPhone.update({
      where: { id: input.id },
      data: {
        extension: input.extension,
        employeeId: input.employeeId ?? null,
        deviceModel: input.deviceModel ?? null,
        macAddress: input.macAddress ?? null,
        location: input.location ?? null,
        status: input.status,
      },
      select: { id: true, extension: true, employeeId: true, status: true },
    });
    return { before, after };
  } catch (error) {
    asConflict(error, `Extension ${input.extension} is already in use.`);
  }
}

export async function deleteIpPhone(_ctx: ActorContext, id: string) {
  const phone = await prisma.ipPhone.findUnique({
    where: { id },
    select: { id: true, extension: true },
  });
  if (!phone) throw new NotFoundError("Phone not found.");
  await prisma.ipPhone.delete({ where: { id } });
  return phone;
}

// --- CCTV --------------------------------------------------------------------

export async function listCctv(ctx: ActorContext) {
  return prisma.cctvDevice.findMany({
    where: { ...companyScopeWhere(ctx) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      ipAddress: true,
      status: true,
      lastMaintenanceAt: true,
      notes: true,
      companyId: true,
      recorderId: true,
      company: { select: { code: true } },
      recorder: { select: { id: true, name: true } },
      _count: { select: { cameras: true } },
    },
  });
}

export async function createCctv(ctx: ActorContext, input: CctvInput) {
  requireCompanyAccess(ctx, input.companyId);

  if (input.recorderId) {
    const recorder = await prisma.cctvDevice.findFirst({
      where: { id: input.recorderId, ...companyScopeWhere(ctx) },
      select: { id: true, type: true, companyId: true, name: true },
    });
    if (!recorder) throw new NotFoundError("Recorder not found.");
    if (recorder.type !== "NVR" && recorder.type !== "DVR") {
      throw new ConflictError(`${recorder.name} is a camera, not a recorder.`);
    }
    if (recorder.companyId !== input.companyId) {
      throw new ConflictError("The recorder belongs to a different company.");
    }
  }

  return prisma.cctvDevice.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      type: input.type,
      location: input.location,
      ipAddress: input.ipAddress ?? null,
      recorderId: input.recorderId ?? null,
      status: input.status,
      lastMaintenanceAt: input.lastMaintenanceAt ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, type: true, companyId: true },
  });
}

export async function updateCctv(ctx: ActorContext, input: CctvInput & { id: string }) {
  const before = await prisma.cctvDevice.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      companyId: true,
      _count: { select: { cameras: true } },
    },
  });
  if (!before) throw new NotFoundError("Device not found.");
  requireCompanyAccess(ctx, input.companyId);

  // Demoting a recorder that still has cameras would orphan them.
  const stillRecorder = input.type === "NVR" || input.type === "DVR";
  if (!stillRecorder && before._count.cameras > 0) {
    throw new ConflictError(
      `${before.name} has ${String(before._count.cameras)} camera(s) attached. Reassign them before changing its type.`,
    );
  }

  if (input.recorderId) {
    if (input.recorderId === input.id) {
      throw new ConflictError("A device cannot record itself.");
    }
    const recorder = await prisma.cctvDevice.findFirst({
      where: { id: input.recorderId, ...companyScopeWhere(ctx) },
      select: { id: true, type: true, name: true, companyId: true },
    });
    if (!recorder) throw new NotFoundError("Recorder not found.");
    if (recorder.type !== "NVR" && recorder.type !== "DVR") {
      throw new ConflictError(`${recorder.name} is a camera, not a recorder.`);
    }
    if (recorder.companyId !== input.companyId) {
      throw new ConflictError("The recorder belongs to a different company.");
    }
  }

  const after = await prisma.cctvDevice.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      name: input.name,
      type: input.type,
      location: input.location,
      ipAddress: input.ipAddress ?? null,
      recorderId: input.recorderId ?? null,
      status: input.status,
      lastMaintenanceAt: input.lastMaintenanceAt ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, name: true, type: true, status: true, companyId: true },
  });

  return { before, after };
}

export async function deleteCctv(ctx: ActorContext, id: string) {
  const device = await prisma.cctvDevice.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      companyId: true,
      _count: { select: { cameras: true } },
    },
  });
  if (!device) throw new NotFoundError("Device not found.");
  if (device._count.cameras > 0) {
    throw new ConflictError(
      `${device._count.cameras} camera(s) record to this device. Reassign them first.`,
    );
  }

  await prisma.cctvDevice.delete({ where: { id } });
  return device;
}

// --- Software licences -------------------------------------------------------

export async function listLicences(ctx: ActorContext) {
  return prisma.softwareLicense.findMany({
    where: { ...companyScopeWhere(ctx) },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      vendor: true,
      seats: true,
      seatsUsed: true,
      purchaseDate: true,
      expiryDate: true,
      notes: true,
      companyId: true,
      licenseKeyCredentialId: true,
      company: { select: { code: true } },
      // The credential's NAME only. The key itself is never read here — the
      // vault's own reveal flow is the only path to it (SECURITY.md §5).
      licenseKey: { select: { id: true, name: true } },
    },
  });
}

/** Credentials that can be linked as a licence key, by name only. */
export async function licenceKeyOptions(ctx: ActorContext) {
  if (!ctx.permissions.has("vault.view")) return [];
  return prisma.credential.findMany({
    where: { deletedAt: null, ...companyScopeWhere(ctx) },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true },
  });
}

function licenceLabel(name: string, vendor: string | null): string {
  return `Licence — ${name}${vendor ? ` (${vendor})` : ""}`;
}

export async function createLicence(ctx: ActorContext, input: LicenceInput) {
  requireCompanyAccess(ctx, input.companyId);

  if (input.licenseKeyCredentialId) {
    const credential = await prisma.credential.findFirst({
      where: {
        id: input.licenseKeyCredentialId,
        deletedAt: null,
        ...companyScopeWhere(ctx),
      },
      select: { id: true },
    });
    if (!credential) throw new NotFoundError("Credential not found.");
  }

  return prisma.$transaction(async (tx) => {
    const licence = await tx.softwareLicense.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        vendor: input.vendor ?? null,
        licenseKeyCredentialId: input.licenseKeyCredentialId ?? null,
        seats: input.seats,
        seatsUsed: input.seatsUsed,
        purchaseDate: input.purchaseDate ?? null,
        expiryDate: input.expiryDate ?? null,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        name: true,
        vendor: true,
        seats: true,
        expiryDate: true,
        companyId: true,
      },
    });

    if (licence.expiryDate) {
      await syncExpiry(
        {
          source: "SOFTWARE_LICENSE",
          sourceId: licence.id,
          companyId: licence.companyId,
          label: licenceLabel(licence.name, licence.vendor),
          expiryDate: licence.expiryDate,
        },
        tx,
      );
    }

    return licence;
  });
}

export async function updateLicence(
  ctx: ActorContext,
  input: LicenceInput & { id: string },
) {
  const before = await prisma.softwareLicense.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      seats: true,
      seatsUsed: true,
      expiryDate: true,
      companyId: true,
    },
  });
  if (!before) throw new NotFoundError("Licence not found.");
  requireCompanyAccess(ctx, input.companyId);

  if (input.licenseKeyCredentialId) {
    const credential = await prisma.credential.findFirst({
      where: {
        id: input.licenseKeyCredentialId,
        deletedAt: null,
        ...companyScopeWhere(ctx),
      },
      select: { id: true },
    });
    if (!credential) throw new NotFoundError("Credential not found.");
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.softwareLicense.update({
      where: { id: input.id },
      data: {
        companyId: input.companyId,
        name: input.name,
        vendor: input.vendor ?? null,
        licenseKeyCredentialId: input.licenseKeyCredentialId ?? null,
        seats: input.seats,
        seatsUsed: input.seatsUsed,
        purchaseDate: input.purchaseDate ?? null,
        expiryDate: input.expiryDate ?? null,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        name: true,
        vendor: true,
        seats: true,
        seatsUsed: true,
        expiryDate: true,
        companyId: true,
      },
    });

    // A licence that loses its expiry date leaves the register; one that gains
    // or changes it updates in place.
    if (after.expiryDate) {
      await syncExpiry(
        {
          source: "SOFTWARE_LICENSE",
          sourceId: after.id,
          companyId: after.companyId,
          label: licenceLabel(after.name, after.vendor),
          expiryDate: after.expiryDate,
        },
        tx,
      );
    } else {
      await deactivateExpiry("SOFTWARE_LICENSE", after.id, tx);
    }

    return { before, after };
  });
}

export async function deleteLicence(ctx: ActorContext, id: string) {
  const licence = await prisma.softwareLicense.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: { id: true, name: true, companyId: true },
  });
  if (!licence) throw new NotFoundError("Licence not found.");

  await prisma.$transaction(async (tx) => {
    await deactivateExpiry("SOFTWARE_LICENSE", id, tx);
    await tx.softwareLicense.delete({ where: { id } });
  });

  return licence;
}

// --- Active Directory --------------------------------------------------------

export async function listAdRecords(
  ctx: ActorContext,
  filters: { q?: string | undefined } = {},
) {
  return prisma.adRecord.findMany({
    where: {
      OR: [{ employeeId: null }, { employee: { ...companyScopeWhere(ctx) } }],
      ...(filters.q
        ? { samAccountName: { contains: filters.q, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { samAccountName: "asc" },
    take: 1000,
    select: {
      id: true,
      samAccountName: true,
      ou: true,
      groups: true,
      enabled: true,
      lastSyncedAt: true,
      notes: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeNo: true,
          status: true,
          company: { select: { code: true } },
        },
      },
    },
  });
}

/** Groups are free text in the form and stored as a JSON array. */
function parseGroups(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .slice(0, 100);
}

export async function createAdRecord(ctx: ActorContext, input: AdRecordInput) {
  if (input.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
  }

  try {
    return await prisma.adRecord.create({
      data: {
        samAccountName: input.samAccountName,
        employeeId: input.employeeId ?? null,
        ou: input.ou ?? null,
        groups: parseGroups(input.groups),
        enabled: input.enabled,
        notes: input.notes ?? null,
      },
      select: { id: true, samAccountName: true, enabled: true, employeeId: true },
    });
  } catch (error) {
    asConflict(error, `The account ${input.samAccountName} is already recorded.`);
  }
}

export async function updateAdRecord(
  ctx: ActorContext,
  input: AdRecordInput & { id: string },
) {
  const before = await prisma.adRecord.findUnique({
    where: { id: input.id },
    select: { id: true, samAccountName: true, enabled: true, employeeId: true, ou: true },
  });
  if (!before) throw new NotFoundError("Record not found.");

  if (input.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError("Employee not found.");
  }

  try {
    const after = await prisma.adRecord.update({
      where: { id: input.id },
      data: {
        samAccountName: input.samAccountName,
        employeeId: input.employeeId ?? null,
        ou: input.ou ?? null,
        groups: parseGroups(input.groups),
        enabled: input.enabled,
        notes: input.notes ?? null,
      },
      select: { id: true, samAccountName: true, enabled: true, employeeId: true, ou: true },
    });
    return { before, after };
  } catch (error) {
    asConflict(error, `The account ${input.samAccountName} is already recorded.`);
  }
}

export async function deleteAdRecord(_ctx: ActorContext, id: string) {
  const record = await prisma.adRecord.findUnique({
    where: { id },
    select: { id: true, samAccountName: true },
  });
  if (!record) throw new NotFoundError("Record not found.");
  await prisma.adRecord.delete({ where: { id } });
  return record;
}

/**
 * AD accounts still enabled for someone who has left.
 *
 * The single most useful thing this table can answer, and the reason it is
 * worth recording directory metadata in an HR system at all.
 */
export async function orphanedAdAccounts(ctx: ActorContext) {
  return prisma.adRecord.findMany({
    where: {
      enabled: true,
      employee: {
        ...companyScopeWhere(ctx),
        status: { in: ["RESIGNED", "TERMINATED", "EXITED", "INACTIVE"] },
      },
    },
    select: {
      id: true,
      samAccountName: true,
      employee: { select: { fullName: true, status: true } },
    },
  });
}

export async function infrastructureCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const [servers, network, cctv, licences, orphaned] = await Promise.all([
    prisma.server.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.networkDevice.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.cctvDevice.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.softwareLicense.count({ where: scope }),
    orphanedAdAccounts(ctx),
  ]);

  return { servers, network, cctv, licences, orphanedAd: orphaned.length };
}
