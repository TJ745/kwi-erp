import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import type {
  SubcontractorContractInput,
  SubcontractorInput,
  SupplierInput,
} from "@/lib/schemas/vendors";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Suppliers and subcontractors — brief §29, §30.
 *
 * A subcontractor's *contracts* carry the expiry date, not the subcontractor
 * itself, so the projection is written per contract (ADR-005). Suppliers have
 * no term and therefore never reach the expiry register.
 */

// --- Suppliers ---------------------------------------------------------------

export async function listSuppliers(
  ctx: ActorContext,
  filters: { status?: string | undefined; q?: string | undefined } = {},
) {
  return prisma.supplier.findMany({
    where: {
      deletedAt: null,
      // Suppliers may be shared across companies, so a null companyId is
      // visible to everyone — same rule as positions and letter templates.
      ...optionalCompanyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "ACTIVE" } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { code: { contains: filters.q, mode: "insensitive" as const } },
              { contactPerson: { contains: filters.q, mode: "insensitive" as const } },
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
      paymentType: true,
      creditDays: true,
      status: true,
      companyId: true,
      categoryId: true,
      notes: true,
      company: { select: { code: true } },
      category: { select: { name: true } },
    },
  });
}

export async function supplierCategories() {
  return prisma.supplierCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function assertSupplierCodeFree(code: string, excludeId?: string) {
  const clash = await prisma.supplier.findFirst({
    // Codes are globally unique in the schema, so this check must be too —
    // scoping it would let two companies claim the same code and fail at insert.
    where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A supplier with code ${code} already exists.`);
}

export async function createSupplier(ctx: ActorContext, input: SupplierInput) {
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);
  await assertSupplierCodeFree(input.code);

  return prisma.supplier.create({
    data: {
      code: input.code,
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      companyId: input.companyId ?? null,
      categoryId: input.categoryId ?? null,
      paymentType: input.paymentType,
      creditDays: input.creditDays ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: { id: true, code: true, name: true, companyId: true },
  });
}

export async function updateSupplier(
  ctx: ActorContext,
  input: SupplierInput & { id: string },
) {
  const before = await prisma.supplier.findFirst({
    where: { id: input.id, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      paymentType: true,
      creditDays: true,
      companyId: true,
    },
  });
  if (!before) throw new NotFoundError("Supplier not found.");
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);
  await assertSupplierCodeFree(input.code, input.id);

  const after = await prisma.supplier.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      companyId: input.companyId ?? null,
      categoryId: input.categoryId ?? null,
      paymentType: input.paymentType,
      creditDays: input.creditDays ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      paymentType: true,
      creditDays: true,
      companyId: true,
    },
  });

  return { before, after };
}

export async function deleteSupplier(ctx: ActorContext, id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    select: { id: true, code: true, name: true, companyId: true },
  });
  if (!supplier) throw new NotFoundError("Supplier not found.");

  // Soft delete: purchase history elsewhere still references this row.
  await prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });
  return supplier;
}

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
          companyId: true,
          company: { select: { code: true } },
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
      },
      select: { id: true, contractNo: true, endDate: true, companyId: true, status: true },
    });

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
  const optional = optionalCompanyScopeWhere(ctx);
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [suppliers, subcontractors, activeContracts, expiringContracts] = await Promise.all([
    prisma.supplier.count({ where: { deletedAt: null, status: "ACTIVE", ...optional } }),
    prisma.subcontractor.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.subcontractorContract.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.subcontractorContract.count({
      where: { status: "ACTIVE", endDate: { gte: now, lte: in60 }, ...scope },
    }),
  ]);

  return { suppliers, subcontractors, activeContracts, expiringContracts };
}

export type SupplierRow = Awaited<ReturnType<typeof listSuppliers>>[number];
