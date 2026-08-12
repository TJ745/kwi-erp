import "server-only";
import type { PolicyStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { expiryCutoff } from "@/lib/expiry";
import type { PolicyInput, ProviderInput } from "@/lib/schemas/insurance";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Medical insurance (brief §31).
 *
 * Two independent axes, deliberately not collapsed into one:
 *   status    — the policy's contractual state (ACTIVE, EXPIRED, …)
 *   isWorking — whether it actually functions at a clinic today
 *
 * A policy can be in-date and not working, which is exactly the situation an
 * administrator needs to see and chase.
 */

export type PolicyListRow = {
  id: string;
  policyNumber: string;
  providerName: string;
  companyCode: string;
  companyId: string;
  providerId: string;
  className: string | null;
  startDate: Date;
  expiryDate: Date;
  status: PolicyStatus;
  isWorking: boolean;
  memberCount: number;
};

export async function listPolicies(
  ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
): Promise<PolicyListRow[]> {
  const where: Prisma.MedicalInsurancePolicyWhereInput = {
    ...companyScopeWhere(ctx),
    ...(filters.status === "NOT_WORKING"
      ? { isWorking: false }
      : filters.status
        ? { status: filters.status as PolicyStatus }
        : {}),
    ...(filters.q
      ? {
          OR: [
            { policyNumber: { contains: filters.q, mode: "insensitive" } },
            { provider: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.medicalInsurancePolicy.findMany({
    where,
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      policyNumber: true,
      className: true,
      startDate: true,
      expiryDate: true,
      status: true,
      isWorking: true,
      companyId: true,
      providerId: true,
      provider: { select: { name: true } },
      company: { select: { code: true } },
      _count: { select: { members: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    policyNumber: p.policyNumber,
    providerName: p.provider.name,
    companyCode: p.company.code,
    companyId: p.companyId,
    providerId: p.providerId,
    className: p.className,
    startDate: p.startDate,
    expiryDate: p.expiryDate,
    status: p.status,
    isWorking: p.isWorking,
    memberCount: p._count.members,
  }));
}

export async function getPolicy(ctx: ActorContext, id: string) {
  const policy = await prisma.medicalInsurancePolicy.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      policyNumber: true,
      className: true,
      startDate: true,
      expiryDate: true,
      status: true,
      isWorking: true,
      coverageLimit: true,
      currency: true,
      notes: true,
      companyId: true,
      providerId: true,
      provider: { select: { name: true } },
      company: { select: { code: true } },
    },
  });
  if (!policy) throw new NotFoundError("Policy not found.");
  return policy;
}

/**
 * A policy belongs in the projection while it is still a live commitment.
 * A cancelled or already-superseded policy should stop generating reminders.
 */
async function syncPolicyExpiry(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  policy: {
    id: string;
    policyNumber: string;
    expiryDate: Date;
    companyId: string;
    status: PolicyStatus;
    providerName: string;
  },
): Promise<void> {
  const live = policy.status === "ACTIVE" || policy.status === "PENDING_RENEWAL";

  if (live) {
    await syncExpiry(
      {
        source: "MEDICAL_INSURANCE_POLICY",
        sourceId: policy.id,
        label: `${policy.providerName} — ${policy.policyNumber}`,
        expiryDate: policy.expiryDate,
        companyId: policy.companyId,
      },
      tx,
    );
  } else {
    await deactivateExpiry("MEDICAL_INSURANCE_POLICY", policy.id, tx);
  }
}

function policyData(input: PolicyInput) {
  return {
    companyId: input.companyId,
    providerId: input.providerId,
    policyNumber: input.policyNumber,
    className: input.className ?? null,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    status: input.status,
    isWorking: input.isWorking,
    coverageLimit: input.coverageLimit ?? null,
    currency: input.currency,
    notes: input.notes ?? null,
  };
}

export async function createPolicy(ctx: ActorContext, input: PolicyInput) {
  requireCompanyAccess(ctx, input.companyId);

  const provider = await prisma.insuranceProvider.findUnique({
    where: { id: input.providerId },
    select: { id: true, name: true },
  });
  if (!provider) throw new NotFoundError("Insurance provider not found.");

  // The schema enforces (providerId, policyNumber) uniqueness; catching it here
  // turns a database error into a message that names the conflict.
  const clash = await prisma.medicalInsurancePolicy.findFirst({
    where: { providerId: input.providerId, policyNumber: input.policyNumber },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(
      `${provider.name} already has a policy numbered ${input.policyNumber}.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const policy = await tx.medicalInsurancePolicy.create({
      data: policyData(input),
      select: {
        id: true,
        policyNumber: true,
        expiryDate: true,
        companyId: true,
        status: true,
      },
    });

    await syncPolicyExpiry(tx, { ...policy, providerName: provider.name });
    return { ...policy, providerName: provider.name };
  });
}

export async function updatePolicy(ctx: ActorContext, input: PolicyInput & { id: string }) {
  const before = await getPolicy(ctx, input.id);
  requireCompanyAccess(ctx, input.companyId);

  const provider = await prisma.insuranceProvider.findUnique({
    where: { id: input.providerId },
    select: { id: true, name: true },
  });
  if (!provider) throw new NotFoundError("Insurance provider not found.");

  if (
    input.policyNumber !== before.policyNumber ||
    input.providerId !== before.providerId
  ) {
    const clash = await prisma.medicalInsurancePolicy.findFirst({
      where: {
        providerId: input.providerId,
        policyNumber: input.policyNumber,
        id: { not: input.id },
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictError(
        `${provider.name} already has a policy numbered ${input.policyNumber}.`,
      );
    }
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.medicalInsurancePolicy.update({
      where: { id: input.id },
      data: policyData(input),
      select: {
        id: true,
        policyNumber: true,
        expiryDate: true,
        companyId: true,
        status: true,
        isWorking: true,
      },
    });

    await syncPolicyExpiry(tx, { ...updated, providerName: provider.name });
    return updated;
  });

  return { before, after, providerName: provider.name };
}

/** Quick toggle for the "working / not working" flag from the list. */
export async function setPolicyWorking(
  ctx: ActorContext,
  input: { id: string; isWorking: boolean },
) {
  const policy = await getPolicy(ctx, input.id);

  await prisma.medicalInsurancePolicy.update({
    where: { id: input.id },
    data: { isWorking: input.isWorking },
  });

  return {
    policyNumber: policy.policyNumber,
    providerName: policy.provider.name,
    companyId: policy.companyId,
    before: { isWorking: policy.isWorking },
    after: { isWorking: input.isWorking },
  };
}

export async function listProviders() {
  return prisma.insuranceProvider.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      isActive: true,
      _count: { select: { policies: true } },
    },
  });
}

export async function createProvider(ctx: ActorContext, input: ProviderInput) {
  void ctx;
  const clash = await prisma.insuranceProvider.findUnique({
    where: { name: input.name },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A provider named "${input.name}" already exists.`);

  return prisma.insuranceProvider.create({
    data: {
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      isActive: input.isActive,
    },
    select: { id: true, name: true },
  });
}

export type InsuranceCounts = {
  active: number;
  expiringIn60Days: number;
  expired: number;
  notWorking: number;
};

export async function insuranceCounts(ctx: ActorContext): Promise<InsuranceCounts> {
  const scope = companyScopeWhere(ctx);
  const now = new Date();

  const [active, expiringIn60Days, expired, notWorking] = await Promise.all([
    prisma.medicalInsurancePolicy.count({ where: { ...scope, status: "ACTIVE" } }),
    prisma.medicalInsurancePolicy.count({
      where: {
        ...scope,
        status: { in: ["ACTIVE", "PENDING_RENEWAL"] },
        expiryDate: { gte: now, lte: expiryCutoff(60, now) },
      },
    }),
    prisma.medicalInsurancePolicy.count({
      where: { ...scope, expiryDate: { lt: now }, status: { not: "CANCELLED" } },
    }),
    // The distinction the brief asks for: in-date but not usable.
    prisma.medicalInsurancePolicy.count({
      where: { ...scope, isWorking: false, status: { in: ["ACTIVE", "PENDING_RENEWAL"] } },
    }),
  ]);

  return { active, expiringIn60Days, expired, notWorking };
}
