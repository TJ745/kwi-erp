import "server-only";
import type { PolicyStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { expiryCutoff } from "@/lib/expiry";
import type { PolicyInput, ProviderInput } from "@/lib/schemas/insurance";
import { deactivateExpiry, syncExpiry } from "./expiry";
import { recordSystemAudit } from "@/server/audit/log";

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
  /** People covered today: cover started, not ended, employee not gone. */
  memberCount: number;
};

/** UTC midnight today. A policy or cover runs through its end date. */
export function startOfTodayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Cover that is in force today. */
export function coveredTodayWhere(now: Date = new Date()): Prisma.EmployeeInsuranceWhereInput {
  const today = startOfTodayUtc(now);
  return {
    status: "ACTIVE",
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };
}

const LEAVING_STATUSES = ["RESIGNED", "TERMINATED", "EXITED"] as const;

/**
 * Brings insurance in line with the calendar, with no one having to remember:
 *
 *   - a policy past its expiry date becomes EXPIRED and not working, and the
 *     cover of everyone still on it ends on that date;
 *   - cover of an employee who has left ends on their last working day;
 *   - cover whose end date has passed is marked EXPIRED.
 *
 * Idempotent, so it is safe to run on every visit to the insurance page as
 * well as from the nightly job: the page is then right even on a day the job
 * did not run.
 */
export async function expireLapsedCover(now: Date = new Date()) {
  const today = startOfTodayUtc(now);

  const lapsed = await prisma.medicalInsurancePolicy.findMany({
    where: { status: { in: ["ACTIVE", "PENDING_RENEWAL"] }, expiryDate: { lt: today } },
    select: {
      id: true,
      policyNumber: true,
      expiryDate: true,
      provider: { select: { name: true } },
    },
  });

  let policiesExpired = 0;
  for (const policy of lapsed) {
    // Conditional on the status still being open: two page loads at the same
    // moment both find the policy, but only the one that flips it records it.
    const [flipped] = await prisma.$transaction([
      prisma.medicalInsurancePolicy.updateMany({
        where: { id: policy.id, status: { in: ["ACTIVE", "PENDING_RENEWAL"] } },
        data: { status: "EXPIRED", isWorking: false },
      }),
      prisma.employeeInsurance.updateMany({
        where: {
          policyId: policy.id,
          OR: [{ endDate: null }, { endDate: { gt: policy.expiryDate } }],
        },
        data: { endDate: policy.expiryDate },
      }),
    ]);
    if (flipped.count === 0) continue;
    policiesExpired += 1;
    await recordSystemAudit({
      action: "UPDATE",
      entityType: "MEDICAL_INSURANCE_POLICY",
      entityId: policy.id,
      actorLabel: "System (insurance expiry)",
      summary: `Policy ${policy.policyNumber} (${policy.provider.name}) expired on ${policy.expiryDate
        .toISOString()
        .slice(0, 10)}: marked expired and not working, members' cover ended`,
    });
  }

  // Employees who have left but are still on a policy.
  const leavers = await prisma.employeeInsurance.findMany({
    where: {
      endDate: null,
      employee: { status: { in: [...LEAVING_STATUSES] }, lastWorkingDate: { not: null } },
    },
    select: { employeeId: true, employee: { select: { lastWorkingDate: true } } },
  });
  for (const l of leavers) {
    if (l.employee.lastWorkingDate)
      await endCoverForLeaver(l.employeeId, l.employee.lastWorkingDate);
  }

  // Cover whose end date has now passed.
  const ended = await prisma.employeeInsurance.updateMany({
    where: { status: "ACTIVE", endDate: { lt: today } },
    data: { status: "EXPIRED" },
  });

  return { policiesExpired, leaversEnded: leavers.length, coverEnded: ended.count };
}

/**
 * Ends every open cover of an employee who is leaving, on their last working
 * day. Cover that already ends earlier is left alone.
 */
export async function endCoverForLeaver(employeeId: string, lastWorkingDate: Date) {
  const today = startOfTodayUtc();
  const result = await prisma.employeeInsurance.updateMany({
    where: {
      employeeId,
      OR: [{ endDate: null }, { endDate: { gt: lastWorkingDate } }],
    },
    data: {
      endDate: lastWorkingDate,
      ...(lastWorkingDate < today ? { status: "EXPIRED" as const } : {}),
    },
  });
  return result.count;
}

export async function listPolicies(
  ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
): Promise<PolicyListRow[]> {
  const where: Prisma.MedicalInsurancePolicyWhereInput = {
    ...companyScopeWhere(ctx),
    ...(filters.status === "NOT_WORKING"
      ? { isWorking: false, status: { not: "CANCELLED" as const } }
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
      _count: { select: { members: { where: coveredTodayWhere() } } },
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

  if (input.policyNumber !== before.policyNumber || input.providerId !== before.providerId) {
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
    // Every policy that does not work at a clinic, including expired ones
    // (which are switched to not working automatically). Same set as the
    // card's filter, so the number and the list agree.
    prisma.medicalInsurancePolicy.count({
      where: { ...scope, isWorking: false, status: { not: "CANCELLED" } },
    }),
  ]);

  return { active, expiringIn60Days, expired, notWorking };
}

// --- Employee enrolment ------------------------------------------------------

/**
 * Who is actually covered by a policy.
 *
 * `EmployeeInsurance` has existed since the first migration and was never
 * written to, which left the module able to say what cover the company buys but
 * not who is on it — the question it exists to answer.
 */
export async function enrolmentsForPolicy(ctx: ActorContext, policyId: string) {
  // Scope is enforced through the policy, which carries the company.
  await getPolicy(ctx, policyId);

  return prisma.employeeInsurance.findMany({
    where: { policyId },
    orderBy: { employee: { fullName: "asc" } },
    select: {
      id: true,
      memberNumber: true,
      className: true,
      startDate: true,
      endDate: true,
      status: true,
      employee: {
        select: { id: true, fullName: true, employeeNo: true, status: true },
      },
    },
  });
}

/** Cover for one employee, for their profile. */
export async function enrolmentsForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.employeeInsurance.findMany({
    where: { employeeId, policy: companyScopeWhere(ctx) },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      memberNumber: true,
      className: true,
      startDate: true,
      endDate: true,
      status: true,
      policy: {
        select: {
          id: true,
          policyNumber: true,
          expiryDate: true,
          provider: { select: { name: true } },
        },
      },
    },
  });
}

export async function enrolEmployee(
  ctx: ActorContext,
  input: {
    policyId: string;
    employeeId: string;
    memberNumber?: string | undefined;
    className?: string | undefined;
    startDate: Date;
    endDate?: Date | undefined;
  },
) {
  const policy = await getPolicy(ctx, input.policyId);

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true, status: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  if (input.endDate && input.endDate.getTime() < input.startDate.getTime()) {
    throw new ConflictError("Cover cannot end before it starts.");
  }

  const existing = await prisma.employeeInsurance.findUnique({
    where: {
      employeeId_policyId: { employeeId: input.employeeId, policyId: input.policyId },
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError("That employee is already on this policy.");

  const enrolment = await prisma.employeeInsurance.create({
    data: {
      employeeId: input.employeeId,
      policyId: input.policyId,
      memberNumber: input.memberNumber ?? null,
      // Falls back to the policy's class, which is the common case: most people
      // are on the policy's default and only a few differ.
      className: input.className ?? policy.className,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      status: "ACTIVE",
    },
    select: { id: true, className: true },
  });

  return { enrolment, employee, policy };
}

/**
 * Puts several employees on a policy at once — the usual case when a policy
 * starts or is renewed. Employees already on it are skipped, not refused, so
 * "select all" can be used again after a few were added by hand.
 */
export async function enrolEmployees(
  ctx: ActorContext,
  input: {
    policyId: string;
    employeeIds: string[];
    memberNumber?: string | undefined;
    className?: string | undefined;
    startDate: Date;
  },
) {
  const policy = await getPolicy(ctx, input.policyId);
  if (policy.status === "EXPIRED" || policy.status === "CANCELLED") {
    throw new ConflictError(
      `This policy is ${policy.status.toLowerCase()}; nobody can be added to it.`,
    );
  }
  if (input.memberNumber && input.employeeIds.length > 1) {
    throw new ConflictError("A member number can only be given when adding one employee.");
  }

  const ids = [...new Set(input.employeeIds)];
  const employees = await prisma.employee.findMany({
    where: { id: { in: ids }, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (employees.length !== ids.length) throw new NotFoundError("Employee not found.");
  // Employees of any group company can be covered by a policy.

  const existing = await prisma.employeeInsurance.findMany({
    where: { policyId: input.policyId, employeeId: { in: ids } },
    select: { employeeId: true },
  });
  const skip = new Set(existing.map((e) => e.employeeId));
  const toAdd = employees.filter((e) => !skip.has(e.id));

  if (toAdd.length > 0) {
    await prisma.employeeInsurance.createMany({
      data: toAdd.map((e) => ({
        employeeId: e.id,
        policyId: input.policyId,
        memberNumber: input.memberNumber ?? null,
        // Most people are on the policy's own class.
        className: input.className ?? policy.className,
        startDate: input.startDate,
        status: "ACTIVE" as const,
      })),
      skipDuplicates: true,
    });
  }

  return { policy, added: toAdd, skipped: skip.size };
}

export async function endEnrolment(ctx: ActorContext, input: { id: string; endDate: Date }) {
  const enrolment = await prisma.employeeInsurance.findFirst({
    where: { id: input.id, policy: companyScopeWhere(ctx) },
    select: {
      id: true,
      startDate: true,
      status: true,
      employee: { select: { fullName: true } },
      policy: { select: { id: true, policyNumber: true, companyId: true } },
    },
  });
  if (!enrolment) throw new NotFoundError("Enrolment not found.");

  if (input.endDate.getTime() < enrolment.startDate.getTime()) {
    throw new ConflictError("Cover cannot end before it starts.");
  }

  // Ended rather than deleted: who was covered when a claim was made is a
  // question that gets asked long afterwards.
  await prisma.employeeInsurance.update({
    where: { id: input.id },
    data: { endDate: input.endDate, status: "EXPIRED" },
  });

  return enrolment;
}
