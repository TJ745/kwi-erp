import "server-only";
import type { ExpirySource } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { DEFAULT_WARNING_DAYS, expiryCutoff, getExpiryStatus } from "@/lib/expiry";
import { logger } from "@/server/logger";

/**
 * The ExpiryIndex projection — ADR-005.
 *
 * Eleven record types carry expiry dates. Without this projection, the
 * dashboard, the reminder engine, and every expiry report would each need an
 * 11-way UNION. Instead each expiry-bearing mutation writes one row here, in
 * the SAME transaction, and everything downstream is a single indexed query.
 *
 * Status is never stored — only the date. See lib/expiry.ts.
 */

type SyncInput = {
  source: ExpirySource;
  sourceId: string;
  label: string;
  expiryDate: Date;
  companyId?: string | null;
  employeeId?: string | null;
  vehicleId?: string | null;
  warningDays?: number[];
};

/**
 * Structural type rather than `TransactionClient | typeof prisma`: the extended
 * client (soft-delete) and the transaction client are different shapes, and
 * unioning them makes TypeScript's inference blow up. Picking only the model we
 * touch accepts both.
 */
type Client = Pick<typeof prisma, "expiryIndex">;

/**
 * Upserts a projection row. Call inside the transaction that writes the source
 * record, so the two commit or roll back together.
 */
export async function syncExpiry(input: SyncInput, tx: Client = prisma): Promise<void> {
  const data = {
    companyId: input.companyId ?? null,
    employeeId: input.employeeId ?? null,
    vehicleId: input.vehicleId ?? null,
    label: input.label,
    expiryDate: input.expiryDate,
    warningDays: input.warningDays ?? [...DEFAULT_WARNING_DAYS],
    isActive: true,
  };

  await tx.expiryIndex.upsert({
    where: { source_sourceId: { source: input.source, sourceId: input.sourceId } },
    update: data,
    create: { source: input.source, sourceId: input.sourceId, ...data },
  });
}

/**
 * Marks a projection row inactive — used when a record is renewed, superseded,
 * or soft-deleted. The row is kept rather than deleted so history remains
 * inspectable.
 */
export async function deactivateExpiry(
  source: ExpirySource,
  sourceId: string,
  tx: Client = prisma,
): Promise<void> {
  await tx.expiryIndex.updateMany({
    where: { source, sourceId },
    data: { isActive: false },
  });
}

export async function removeExpiry(
  source: ExpirySource,
  sourceId: string,
  tx: Client = prisma,
): Promise<void> {
  await tx.expiryIndex.deleteMany({ where: { source, sourceId } });
}

// --- Read side ---------------------------------------------------------------

export type ExpiringItem = {
  id: string;
  source: ExpirySource;
  sourceId: string;
  label: string;
  expiryDate: Date;
  employeeId: string | null;
  companyId: string | null;
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED";
  daysRemaining: number;
};

/**
 * Everything expiring within `withinDays`, plus anything already expired.
 * Company-scoped, so a KWI user never sees ICC expiries.
 */
export async function listExpiring(
  ctx: ActorContext,
  options: { withinDays?: number; sources?: ExpirySource[]; limit?: number } = {},
): Promise<ExpiringItem[]> {
  const withinDays = options.withinDays ?? 90;

  const rows = await prisma.expiryIndex.findMany({
    where: {
      isActive: true,
      expiryDate: { lte: expiryCutoff(withinDays) },
      ...(options.sources ? { source: { in: options.sources } } : {}),
      ...companyScopeWhere(ctx),
    },
    orderBy: { expiryDate: "asc" },
    take: options.limit ?? 100,
    select: {
      id: true,
      source: true,
      sourceId: true,
      label: true,
      expiryDate: true,
      employeeId: true,
      companyId: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    status: getExpiryStatus(row.expiryDate),
    daysRemaining: Math.ceil((row.expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  }));
}

/** Counts per bucket for the dashboard and the Iqama workspace (brief §11). */
export async function expiryBuckets(
  ctx: ActorContext,
  buckets: readonly number[],
  sources?: ExpirySource[],
): Promise<{ expired: number; buckets: { days: number; count: number }[] }> {
  const scope = {
    isActive: true,
    ...(sources ? { source: { in: sources } } : {}),
    ...companyScopeWhere(ctx),
  };

  const now = new Date();

  const [expired, ...counts] = await Promise.all([
    prisma.expiryIndex.count({ where: { ...scope, expiryDate: { lt: startOfToday(now) } } }),
    ...buckets.map((days) =>
      prisma.expiryIndex.count({
        where: {
          ...scope,
          expiryDate: { gte: startOfToday(now), lte: expiryCutoff(days, now) },
        },
      }),
    ),
  ]);

  return {
    expired: expired ?? 0,
    buckets: buckets.map((days, index) => ({ days, count: counts[index] ?? 0 })),
  };
}

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// --- Reconciliation ----------------------------------------------------------

/**
 * Rebuilds the projection from its source tables.
 *
 * This is the self-healing half of ADR-005: if a new code path ever forgets to
 * call syncExpiry, the nightly run corrects it within 24 hours and logs the
 * drift so the omission gets found. Without it, a missed write would silently
 * suppress a reminder forever.
 */
export async function reconcileExpiryIndex(): Promise<{
  scanned: number;
  created: number;
  updated: number;
  deactivated: number;
}> {
  const seen = new Set<string>();
  let created = 0;
  let updated = 0;

  const existing = await prisma.expiryIndex.findMany({
    select: { source: true, sourceId: true, expiryDate: true, isActive: true, label: true },
  });
  const existingMap = new Map(existing.map((e) => [`${e.source}:${e.sourceId}`, e]));

  async function apply(input: SyncInput) {
    const key = `${input.source}:${input.sourceId}`;
    seen.add(key);
    const prev = existingMap.get(key);

    if (!prev) {
      created += 1;
      await syncExpiry(input);
      return;
    }
    const changed =
      prev.expiryDate.getTime() !== input.expiryDate.getTime() ||
      prev.label !== input.label ||
      !prev.isActive;
    if (changed) {
      updated += 1;
      await syncExpiry(input);
    }
  }

  // --- Iqama ---
  const iqamas = await prisma.iqamaRecord.findMany({
    select: {
      id: true,
      expiryDate: true,
      employee: { select: { id: true, fullName: true, companyId: true, deletedAt: true } },
    },
  });
  for (const row of iqamas) {
    if (row.employee.deletedAt) continue;
    await apply({
      source: "IQAMA",
      sourceId: row.id,
      label: `Iqama — ${row.employee.fullName}`,
      expiryDate: row.expiryDate,
      employeeId: row.employee.id,
      companyId: row.employee.companyId,
    });
  }

  // --- Passport ---
  const passports = await prisma.passportRecord.findMany({
    select: {
      id: true,
      expiryDate: true,
      employee: { select: { id: true, fullName: true, companyId: true, deletedAt: true } },
    },
  });
  for (const row of passports) {
    if (row.employee.deletedAt) continue;
    await apply({
      source: "PASSPORT",
      sourceId: row.id,
      label: `Passport — ${row.employee.fullName}`,
      expiryDate: row.expiryDate,
      employeeId: row.employee.id,
      companyId: row.employee.companyId,
    });
  }

  // --- Employee contracts ---
  const contracts = await prisma.contract.findMany({
    where: { endDate: { not: null }, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      endDate: true,
      companyId: true,
      employee: { select: { id: true, fullName: true, deletedAt: true } },
    },
  });
  for (const row of contracts) {
    if (!row.endDate || row.employee.deletedAt) continue;
    await apply({
      source: "EMPLOYEE_CONTRACT",
      sourceId: row.id,
      label: `Contract — ${row.employee.fullName}`,
      expiryDate: row.endDate,
      employeeId: row.employee.id,
      companyId: row.companyId,
    });
  }

  // --- Documents with an expiry ---
  const documents = await prisma.document.findMany({
    where: { expiryDate: { not: null }, deletedAt: null, supersededBy: null },
    select: {
      id: true,
      title: true,
      expiryDate: true,
      companyId: true,
      entityType: true,
      entityId: true,
    },
  });
  for (const row of documents) {
    if (!row.expiryDate) continue;
    await apply({
      source: "DOCUMENT",
      sourceId: row.id,
      label: row.title,
      expiryDate: row.expiryDate,
      companyId: row.companyId,
      employeeId: row.entityType === "EMPLOYEE" ? row.entityId : null,
    });
  }

  // --- Company certificates ---
  const certificates = await prisma.companyCertificate.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      certificateNo: true,
      expiryDate: true,
      companyId: true,
      certificateType: { select: { name: true } },
      company: { select: { code: true } },
    },
  });
  for (const row of certificates) {
    await apply({
      source: "COMPANY_CERTIFICATE",
      sourceId: row.id,
      label: `${row.certificateType.name} — ${row.company.code}`,
      expiryDate: row.expiryDate,
      companyId: row.companyId,
    });
  }

  // --- Vehicles: registration and insurance are separate sources ---
  const vehicles = await prisma.vehicle.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      plateNumber: true,
      companyId: true,
      registrationExpiry: true,
      insuranceExpiry: true,
    },
  });
  for (const row of vehicles) {
    if (row.registrationExpiry) {
      await apply({
        source: "VEHICLE_REGISTRATION",
        sourceId: row.id,
        label: `Registration — ${row.plateNumber}`,
        expiryDate: row.registrationExpiry,
        companyId: row.companyId,
        vehicleId: row.id,
      });
    }
    if (row.insuranceExpiry) {
      await apply({
        // Distinct sourceId: one vehicle row feeds two projection rows.
        source: "VEHICLE_INSURANCE",
        sourceId: row.id,
        label: `Insurance — ${row.plateNumber}`,
        expiryDate: row.insuranceExpiry,
        companyId: row.companyId,
        vehicleId: row.id,
      });
    }
  }

  // --- Subcontractor contracts ---
  const subContracts = await prisma.subcontractorContract.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      contractNo: true,
      endDate: true,
      companyId: true,
      subcontractor: { select: { name: true } },
    },
  });
  for (const row of subContracts) {
    await apply({
      source: "SUBCONTRACTOR_CONTRACT",
      sourceId: row.id,
      label: `${row.subcontractor.name} — ${row.contractNo}`,
      expiryDate: row.endDate,
      companyId: row.companyId,
    });
  }

  // --- Medical insurance policies ---
  const policies = await prisma.medicalInsurancePolicy.findMany({
    where: { status: { in: ["ACTIVE", "PENDING_RENEWAL"] } },
    select: {
      id: true,
      policyNumber: true,
      expiryDate: true,
      companyId: true,
      provider: { select: { name: true } },
    },
  });
  for (const row of policies) {
    await apply({
      source: "MEDICAL_INSURANCE_POLICY",
      sourceId: row.id,
      label: `${row.provider.name} — ${row.policyNumber}`,
      expiryDate: row.expiryDate,
      companyId: row.companyId,
    });
  }

  // --- IT asset warranties ---
  const assets = await prisma.iTAsset.findMany({
    where: {
      warrantyExpiry: { not: null },
      deletedAt: null,
      status: { notIn: ["DISPOSED", "RETIRED"] },
    },
    select: {
      id: true,
      assetCode: true,
      brand: true,
      model: true,
      warrantyExpiry: true,
      companyId: true,
    },
  });
  for (const row of assets) {
    if (!row.warrantyExpiry) continue;
    await apply({
      source: "IT_ASSET_WARRANTY",
      sourceId: row.id,
      label: `Warranty — ${row.assetCode} ${row.brand} ${row.model}`,
      expiryDate: row.warrantyExpiry,
      companyId: row.companyId,
    });
  }

  // --- Deactivate rows whose source no longer qualifies ---
  const stale = existing.filter((e) => e.isActive && !seen.has(`${e.source}:${e.sourceId}`));
  for (const row of stale) {
    await deactivateExpiry(row.source, row.sourceId);
  }

  const result = {
    scanned: seen.size,
    created,
    updated,
    deactivated: stale.length,
  };

  // Drift means a code path skipped syncExpiry — log it so the bug gets found
  // rather than silently corrected every night.
  if (created > 0 || updated > 0 || stale.length > 0) {
    logger.warn("Expiry index drift corrected", result);
  }

  return result;
}
