import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { expiryCutoff, businessStartOfDay } from "@/lib/expiry";
import type { BillInput, CertificateInput } from "@/lib/schemas/compliance";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Company certificates and electricity bills — brief §34, §35.
 *
 * A certificate's expiry is projected into ExpiryIndex so it reaches the same
 * reminder engine, dashboard cards, and expiry report as every other expiring
 * record (ADR-005). A bill is not an expiry — it is a payment obligation — so
 * it stays out of that projection and carries its own status instead.
 */

// --- Company certificates ----------------------------------------------------

export async function listCertificates(
  ctx: ActorContext,
  filters: { status?: string | undefined; typeId?: string | undefined } = {},
) {
  return prisma.companyCertificate.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.typeId ? { certificateTypeId: filters.typeId } : {}),
    },
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      certificateNo: true,
      issueDate: true,
      expiryDate: true,
      issuingAuthority: true,
      status: true,
      notes: true,
      companyId: true,
      certificateTypeId: true,
      company: { select: { code: true, name: true } },
      certificateType: { select: { id: true, name: true } },
    },
  });
}

export async function certificateTypes() {
  return prisma.certificateType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, key: true },
  });
}

function certificateLabel(typeName: string, companyCode: string): string {
  return `${typeName} — ${companyCode}`;
}

export async function createCertificate(ctx: ActorContext, input: CertificateInput) {
  requireCompanyAccess(ctx, input.companyId);

  const [company, type] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: input.companyId },
      select: { code: true },
    }),
    prisma.certificateType.findUnique({
      where: { id: input.certificateTypeId },
      select: { name: true },
    }),
  ]);
  if (!type) throw new NotFoundError("Certificate type not found.");

  const clash = await prisma.companyCertificate.findFirst({
    where: {
      companyId: input.companyId,
      certificateTypeId: input.certificateTypeId,
      certificateNo: input.certificateNo,
    },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(
      `${company.code} already has a ${type.name} numbered ${input.certificateNo}.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const certificate = await tx.companyCertificate.create({
      data: {
        companyId: input.companyId,
        certificateTypeId: input.certificateTypeId,
        certificateNo: input.certificateNo,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        issuingAuthority: input.issuingAuthority ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        certificateNo: true,
        expiryDate: true,
        companyId: true,
        status: true,
      },
    });

    if (certificate.status === "ACTIVE") {
      await syncExpiry(
        {
          source: "COMPANY_CERTIFICATE",
          sourceId: certificate.id,
          companyId: certificate.companyId,
          label: certificateLabel(type.name, company.code),
          expiryDate: certificate.expiryDate,
        },
        tx,
      );
    }

    return { ...certificate, typeName: type.name, companyCode: company.code };
  });
}

export async function updateCertificate(
  ctx: ActorContext,
  input: CertificateInput & { id: string },
) {
  const before = await prisma.companyCertificate.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      certificateNo: true,
      issueDate: true,
      expiryDate: true,
      status: true,
      companyId: true,
      certificateType: { select: { name: true } },
    },
  });
  if (!before) throw new NotFoundError("Certificate not found.");
  requireCompanyAccess(ctx, input.companyId);

  const clash = await prisma.companyCertificate.findFirst({
    where: {
      companyId: input.companyId,
      certificateTypeId: input.certificateTypeId,
      certificateNo: input.certificateNo,
      id: { not: input.id },
    },
    select: { id: true },
  });
  if (clash) throw new ConflictError("Another certificate already uses that number.");

  const [company, type] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: input.companyId },
      select: { code: true },
    }),
    prisma.certificateType.findUniqueOrThrow({
      where: { id: input.certificateTypeId },
      select: { name: true },
    }),
  ]);

  return prisma.$transaction(async (tx) => {
    const after = await tx.companyCertificate.update({
      where: { id: input.id },
      data: {
        companyId: input.companyId,
        certificateTypeId: input.certificateTypeId,
        certificateNo: input.certificateNo,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        issuingAuthority: input.issuingAuthority ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        certificateNo: true,
        issueDate: true,
        expiryDate: true,
        status: true,
        companyId: true,
      },
    });

    // A renewed certificate gets a new expiry; an archived one must stop
    // producing reminders for a document nobody is chasing any more.
    if (after.status === "ACTIVE") {
      await syncExpiry(
        {
          source: "COMPANY_CERTIFICATE",
          sourceId: after.id,
          companyId: after.companyId,
          label: certificateLabel(type.name, company.code),
          expiryDate: after.expiryDate,
        },
        tx,
      );
    } else {
      await deactivateExpiry("COMPANY_CERTIFICATE", after.id, tx);
    }

    return { before, after, typeName: type.name, companyCode: company.code };
  });
}

export async function deleteCertificate(ctx: ActorContext, id: string) {
  const certificate = await prisma.companyCertificate.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      certificateNo: true,
      companyId: true,
      certificateType: { select: { name: true } },
      company: { select: { code: true } },
    },
  });
  if (!certificate) throw new NotFoundError("Certificate not found.");

  await prisma.$transaction(async (tx) => {
    await deactivateExpiry("COMPANY_CERTIFICATE", id, tx);
    await tx.companyCertificate.delete({ where: { id } });
  });

  return certificate;
}

export async function certificateCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const now = new Date();

  const [total, expiringSoon, expired] = await Promise.all([
    prisma.companyCertificate.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.companyCertificate.count({
      where: {
        status: "ACTIVE",
        expiryDate: { gte: businessStartOfDay(now), lte: expiryCutoff(60, now) },
        ...scope,
      },
    }),
    prisma.companyCertificate.count({
      where: { status: "ACTIVE", expiryDate: { lt: businessStartOfDay(now) }, ...scope },
    }),
  ]);

  return { total, expiringSoon, expired };
}

// --- Electricity bills -------------------------------------------------------

export async function listBills(
  ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
) {
  return prisma.electricityBill.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...(filters.q
        ? {
            OR: [
              { location: { contains: filters.q, mode: "insensitive" as const } },
              { meterNumber: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 500,
    select: {
      id: true,
      location: true,
      meterNumber: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      amount: true,
      currency: true,
      dueDate: true,
      paidDate: true,
      status: true,
      notes: true,
      companyId: true,
      accommodationId: true,
      company: { select: { code: true } },
      accommodation: { select: { name: true } },
    },
  });
}

export async function accommodationOptions(ctx: ActorContext) {
  return prisma.accommodation.findMany({
    where: { ...companyScopeWhere(ctx) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, companyId: true },
  });
}

async function assertMeterPeriodFree(
  meterNumber: string,
  billingPeriodStart: Date,
  excludeId?: string,
) {
  // Mirrors the DB unique constraint. Catching it here produces a sentence the
  // user can act on instead of a raw constraint violation.
  const clash = await prisma.electricityBill.findFirst({
    where: {
      meterNumber,
      billingPeriodStart,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(
      `Meter ${meterNumber} already has a bill for a period starting ${billingPeriodStart.toISOString().slice(0, 10)}.`,
    );
  }
}

export async function createBill(ctx: ActorContext, input: BillInput) {
  requireCompanyAccess(ctx, input.companyId);
  await assertMeterPeriodFree(input.meterNumber, input.billingPeriodStart);

  if (input.accommodationId) {
    const accommodation = await prisma.accommodation.findFirst({
      where: { id: input.accommodationId, ...companyScopeWhere(ctx) },
      select: { companyId: true },
    });
    if (!accommodation) throw new NotFoundError("Accommodation not found.");
    if (accommodation.companyId !== input.companyId) {
      throw new ConflictError("That accommodation belongs to a different company.");
    }
  }

  return prisma.electricityBill.create({
    data: {
      companyId: input.companyId,
      accommodationId: input.accommodationId ?? null,
      location: input.location,
      meterNumber: input.meterNumber,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      amount: input.amount,
      currency: input.currency,
      dueDate: input.dueDate,
      paidDate: input.paidDate ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      meterNumber: true,
      location: true,
      amount: true,
      currency: true,
      dueDate: true,
      status: true,
      companyId: true,
    },
  });
}

export async function updateBill(ctx: ActorContext, input: BillInput & { id: string }) {
  const before = await prisma.electricityBill.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      meterNumber: true,
      amount: true,
      dueDate: true,
      paidDate: true,
      status: true,
      companyId: true,
    },
  });
  if (!before) throw new NotFoundError("Bill not found.");
  requireCompanyAccess(ctx, input.companyId);
  await assertMeterPeriodFree(input.meterNumber, input.billingPeriodStart, input.id);

  const after = await prisma.electricityBill.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      accommodationId: input.accommodationId ?? null,
      location: input.location,
      meterNumber: input.meterNumber,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      amount: input.amount,
      currency: input.currency,
      dueDate: input.dueDate,
      paidDate: input.paidDate ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      meterNumber: true,
      amount: true,
      dueDate: true,
      paidDate: true,
      status: true,
      companyId: true,
    },
  });

  return { before, after };
}

/**
 * Marking a bill paid is its own action.
 *
 * It is the frequent, low-ceremony update — the accounts clerk should not have
 * to open a full edit form to record a payment, and the narrower action is
 * easier to audit meaningfully.
 */
export async function markBillPaid(
  ctx: ActorContext,
  input: { id: string; paidDate: Date },
) {
  const bill = await prisma.electricityBill.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      meterNumber: true,
      amount: true,
      currency: true,
      status: true,
      companyId: true,
    },
  });
  if (!bill) throw new NotFoundError("Bill not found.");
  if (bill.status === "PAID") throw new ConflictError("That bill is already marked paid.");

  await prisma.electricityBill.update({
    where: { id: input.id },
    data: { status: "PAID", paidDate: input.paidDate },
  });

  return { ...bill, before: bill.status, after: "PAID" as const };
}

export async function deleteBill(ctx: ActorContext, id: string) {
  const bill = await prisma.electricityBill.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: { id: true, meterNumber: true, location: true, companyId: true },
  });
  if (!bill) throw new NotFoundError("Bill not found.");

  await prisma.electricityBill.delete({ where: { id } });
  return bill;
}

export async function billCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const now = new Date();

  const [pending, overdue, paidThisMonth] = await Promise.all([
    prisma.electricityBill.count({ where: { status: "PENDING", ...scope } }),
    // Derived, not trusted: a bill left PENDING past its due date is overdue
    // whether or not anyone has run a job to relabel it.
    prisma.electricityBill.count({
      where: { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: now }, ...scope },
    }),
    prisma.electricityBill.count({
      where: {
        status: "PAID",
        paidDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        ...scope,
      },
    }),
  ]);

  const outstanding = await prisma.electricityBill.aggregate({
    where: { status: { in: ["PENDING", "OVERDUE"] }, ...scope },
    _sum: { amount: true },
  });

  return {
    pending,
    overdue,
    paidThisMonth,
    outstandingAmount: outstanding._sum.amount?.toString() ?? "0",
  };
}
