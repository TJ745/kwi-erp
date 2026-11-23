import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { expiryCutoff, businessStartOfDay } from "@/lib/expiry";
import type { CertificateInput } from "@/lib/schemas/compliance";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Company certificates — brief §34.
 *
 * A certificate's expiry is projected into ExpiryIndex so it reaches the same
 * reminder engine, dashboard cards, and expiry report as every other expiring
 * record (ADR-005).
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
