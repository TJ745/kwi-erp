import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import type { SubcontractorContractInput, SubcontractorInput } from "@/lib/schemas/vendors";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Subcontractors — brief §30.
 *
 * A subcontractor's *contracts* carry the expiry date, not the subcontractor
 * itself, so the projection is written per contract (ADR-005).
 */

// --- Subcontractors ----------------------------------------------------------

export async function listSubcontractors(
  _ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
) {
  // Subcontractors are company-agnostic; their CONTRACTS carry the company, and
  // those are scoped where they are listed.
  return prisma.subcontractor.findMany({
    where: {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { code: { contains: filters.q, mode: "insensitive" as const } },
              { crNumber: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      crNumber: true,
      address: true,
      status: true,
      notes: true,
      _count: { select: { contracts: true } },
    },
  });
}

export async function getSubcontractor(ctx: ActorContext, id: string) {
  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      crNumber: true,
      address: true,
      status: true,
      notes: true,
      contracts: {
        // The contract list IS company-owned, so it is scoped here even though
        // the parent is not.
        where: { ...companyScopeWhere(ctx) },
        orderBy: { endDate: "desc" },
        select: {
          id: true,
          contractNo: true,
          scope: true,
          startDate: true,
          endDate: true,
          value: true,
          currency: true,
          status: true,
          notes: true,
          agreementDate: true,
          terms: true,
          companyId: true,
          company: { select: { code: true } },
          rates: {
            orderBy: { sortOrder: "asc" },
            select: { category: true, rate: true, unit: true },
          },
        },
      },
    },
  });
  if (!subcontractor) throw new NotFoundError("Subcontractor not found.");
  return subcontractor;
}

async function assertSubcontractorCodeFree(code: string, excludeId?: string) {
  const clash = await prisma.subcontractor.findFirst({
    where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A subcontractor with code ${code} already exists.`);
}

export async function createSubcontractor(_ctx: ActorContext, input: SubcontractorInput) {
  await assertSubcontractorCodeFree(input.code);
  return prisma.subcontractor.create({
    data: {
      code: input.code,
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      crNumber: input.crNumber ?? null,
      address: input.address ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: { id: true, code: true, name: true },
  });
}

export async function updateSubcontractor(
  _ctx: ActorContext,
  input: SubcontractorInput & { id: string },
) {
  const before = await prisma.subcontractor.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, code: true, name: true, status: true, crNumber: true },
  });
  if (!before) throw new NotFoundError("Subcontractor not found.");
  await assertSubcontractorCodeFree(input.code, input.id);

  const after = await prisma.subcontractor.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      crNumber: input.crNumber ?? null,
      address: input.address ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: { id: true, code: true, name: true, status: true, crNumber: true },
  });

  return { before, after };
}

export async function deleteSubcontractor(_ctx: ActorContext, id: string) {
  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, code: true, name: true, _count: { select: { contracts: true } } },
  });
  if (!subcontractor) throw new NotFoundError("Subcontractor not found.");

  await prisma.$transaction(async (tx) => {
    const contracts = await tx.subcontractorContract.findMany({
      where: { subcontractorId: id },
      select: { id: true },
    });
    // Every contract leaves the expiry register with the subcontractor, or the
    // reminder engine keeps nagging about a party that no longer exists.
    for (const contract of contracts) {
      await deactivateExpiry("SUBCONTRACTOR_CONTRACT", contract.id, tx);
    }
    await tx.subcontractor.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
  });

  return subcontractor;
}

// --- Subcontractor contracts -------------------------------------------------

export async function listSubcontractorContracts(
  ctx: ActorContext,
  filters: { status?: string | undefined } = {},
) {
  return prisma.subcontractorContract.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
    },
    orderBy: { endDate: "asc" },
    take: 500,
    select: {
      id: true,
      contractNo: true,
      startDate: true,
      endDate: true,
      value: true,
      currency: true,
      status: true,
      companyId: true,
      company: { select: { code: true } },
      subcontractor: { select: { id: true, code: true, name: true } },
    },
  });
}

async function writeRates(
  tx: Pick<typeof prisma, "subcontractorContractRate">,
  contractId: string,
  rates: SubcontractorContractInput["rates"],
) {
  if (rates.length === 0) return;
  await tx.subcontractorContractRate.createMany({
    data: rates.map((r, index) => ({
      contractId,
      sortOrder: index,
      category: r.category,
      rate: r.rate,
      unit: r.unit,
    })),
  });
}

/** The label the expiry register and reminders will show. */
function contractLabel(subcontractorName: string, contractNo: string): string {
  return `Subcontract ${contractNo} — ${subcontractorName}`;
}

export async function createSubcontractorContract(
  ctx: ActorContext,
  input: SubcontractorContractInput,
) {
  requireCompanyAccess(ctx, input.companyId);

  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id: input.subcontractorId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!subcontractor) throw new NotFoundError("Subcontractor not found.");

  const clash = await prisma.subcontractorContract.findFirst({
    where: { subcontractorId: input.subcontractorId, contractNo: input.contractNo },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(
      `${subcontractor.name} already has a contract numbered ${input.contractNo}.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const contract = await tx.subcontractorContract.create({
      data: {
        subcontractorId: input.subcontractorId,
        companyId: input.companyId,
        contractNo: input.contractNo,
        scope: input.scope ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        value: input.value ?? null,
        currency: input.currency,
        status: input.status,
        notes: input.notes ?? null,
        agreementDate: input.agreementDate ?? null,
        terms: input.terms ?? null,
      },
      select: { id: true, contractNo: true, endDate: true, companyId: true, status: true },
    });
    await writeRates(tx, contract.id, input.rates);

    // Written inside the transaction (ADR-005), so the projection cannot
    // disagree with the row that produced it.
    if (contract.status === "ACTIVE") {
      await syncExpiry(
        {
          source: "SUBCONTRACTOR_CONTRACT",
          sourceId: contract.id,
          companyId: contract.companyId,
          label: contractLabel(subcontractor.name, contract.contractNo),
          expiryDate: contract.endDate,
        },
        tx,
      );
    }

    return { ...contract, subcontractorName: subcontractor.name };
  });
}

export async function updateSubcontractorContract(
  ctx: ActorContext,
  input: SubcontractorContractInput & { id: string },
) {
  const before = await prisma.subcontractorContract.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      contractNo: true,
      startDate: true,
      endDate: true,
      status: true,
      value: true,
      companyId: true,
      subcontractor: { select: { name: true } },
    },
  });
  if (!before) throw new NotFoundError("Contract not found.");
  requireCompanyAccess(ctx, input.companyId);

  const clash = await prisma.subcontractorContract.findFirst({
    where: {
      subcontractorId: input.subcontractorId,
      contractNo: input.contractNo,
      id: { not: input.id },
    },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`Contract ${input.contractNo} already exists.`);

  return prisma.$transaction(async (tx) => {
    const after = await tx.subcontractorContract.update({
      where: { id: input.id },
      data: {
        subcontractorId: input.subcontractorId,
        companyId: input.companyId,
        contractNo: input.contractNo,
        scope: input.scope ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        value: input.value ?? null,
        currency: input.currency,
        status: input.status,
        notes: input.notes ?? null,
        agreementDate: input.agreementDate ?? null,
        terms: input.terms ?? null,
      },
      select: {
        id: true,
        contractNo: true,
        startDate: true,
        endDate: true,
        status: true,
        value: true,
        companyId: true,
        subcontractor: { select: { name: true } },
      },
    });
    // The schedule is replaced as a whole: rows have no identity a person
    // would track, only an order.
    await tx.subcontractorContractRate.deleteMany({ where: { contractId: after.id } });
    await writeRates(tx, after.id, input.rates);

    // A terminated or expired contract must stop generating reminders; an
    // active one must reflect the new date.
    if (after.status === "ACTIVE") {
      await syncExpiry(
        {
          source: "SUBCONTRACTOR_CONTRACT",
          sourceId: after.id,
          companyId: after.companyId,
          label: contractLabel(after.subcontractor.name, after.contractNo),
          expiryDate: after.endDate,
        },
        tx,
      );
    } else {
      await deactivateExpiry("SUBCONTRACTOR_CONTRACT", after.id, tx);
    }

    return { before, after };
  });
}

export async function deleteSubcontractorContract(ctx: ActorContext, id: string) {
  const contract = await prisma.subcontractorContract.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      contractNo: true,
      companyId: true,
      subcontractor: { select: { name: true } },
    },
  });
  if (!contract) throw new NotFoundError("Contract not found.");

  await prisma.$transaction(async (tx) => {
    await deactivateExpiry("SUBCONTRACTOR_CONTRACT", id, tx);
    await tx.subcontractorContract.delete({ where: { id } });
  });

  return contract;
}

/** Counts for the page header. */
export async function vendorCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [subcontractors, activeContracts, expiringContracts] = await Promise.all([
    prisma.subcontractor.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.subcontractorContract.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.subcontractorContract.count({
      where: { status: "ACTIVE", endDate: { gte: now, lte: in60 }, ...scope },
    }),
  ]);

  return { subcontractors, activeContracts, expiringContracts };
}

/**
 * Everything the printed agreement needs: the contract, its rate schedule,
 * both parties, and the company letterhead.
 */
export async function getSubcontractorContractForPrint(ctx: ActorContext, id: string) {
  const contract = await prisma.subcontractorContract.findFirst({
    where: { id, ...companyScopeWhere(ctx), subcontractor: { deletedAt: null } },
    select: {
      id: true,
      contractNo: true,
      scope: true,
      startDate: true,
      endDate: true,
      agreementDate: true,
      createdAt: true,
      currency: true,
      status: true,
      terms: true,
      rates: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, category: true, rate: true, unit: true },
      },
      subcontractor: { select: { id: true, name: true, address: true, crNumber: true } },
      company: {
        select: {
          id: true,
          name: true,
          addressLine: true,
          city: true,
          country: true,
          crNumber: true,
          vatNumber: true,
          phone: true,
          email: true,
          website: true,
          headerImageFileId: true,
          footerImageFileId: true,
        },
      },
    },
  });
  if (!contract) throw new NotFoundError("Contract not found.");
  return contract;
}

// --- Default terms -------------------------------------------------------------

const DEFAULTS_ID = "default";

/** The shared terms a new agreement starts from, one per line. */
export async function getSubcontractDefaultTerms(): Promise<string> {
  const row = await prisma.subcontractDefaults.findUnique({
    where: { id: DEFAULTS_ID },
    select: { terms: true },
  });
  return row?.terms ?? "";
}

export async function updateSubcontractDefaultTerms(_ctx: ActorContext, terms: string) {
  const before = await getSubcontractDefaultTerms();
  await prisma.subcontractDefaults.upsert({
    where: { id: DEFAULTS_ID },
    create: { id: DEFAULTS_ID, terms },
    update: { terms },
  });
  return { before, after: terms };
}
