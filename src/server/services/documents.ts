import "server-only";
import type { EntityType, Prisma } from "@/generated/prisma/client";
import type { UploadEntityType } from "@/lib/upload-entities";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import {
  companyScopeWhere,
  defaultCompanyId,
  optionalCompanyScopeWhere,
  requireCompanyAccess,
} from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import { deactivateExpiry, syncExpiry } from "./expiry";
import { deleteStoredFile } from "@/server/storage/uploadthing";

/**
 * Document register.
 *
 * One polymorphic table serves every entity (docs/DATABASE.md §6). Documents
 * with an expiry feed the ExpiryIndex projection in the same transaction, so a
 * newly uploaded Iqama copy appears in the dashboard immediately.
 */

const SORTABLE = ["title", "issueDate", "expiryDate", "createdAt"] as const;

export type DocumentListRow = {
  id: string;
  title: string;
  documentNo: string | null;
  typeName: string;
  entityType: EntityType;
  entityId: string;
  issueDate: Date | null;
  expiryDate: Date | null;
  fileId: string;
  originalName: string;
  sizeBytes: number;
  companyCode: string;
  version: number;
  createdAt: Date;
};

export async function listDocuments(
  ctx: ActorContext,
  query: ListQuery,
  filters: { entityType?: EntityType; entityId?: string; typeId?: string } = {},
): Promise<Paginated<DocumentListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "createdAt", direction: "desc" });

  const where: Prisma.DocumentWhereInput = {
    ...companyScopeWhere(ctx),
    // Superseded versions are hidden from the register; the current one links
    // back through the renewal chain.
    supersededBy: null,
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.typeId ? { documentTypeId: filters.typeId } : {}),
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        title: true,
        documentNo: true,
        entityType: true,
        entityId: true,
        issueDate: true,
        expiryDate: true,
        fileId: true,
        version: true,
        createdAt: true,
        documentType: { select: { name: true } },
        company: { select: { code: true } },
        file: { select: { originalName: true, sizeBytes: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return paginate(
    rows.map((d) => ({
      id: d.id,
      title: d.title,
      documentNo: d.documentNo,
      typeName: d.documentType.name,
      entityType: d.entityType,
      entityId: d.entityId,
      issueDate: d.issueDate,
      expiryDate: d.expiryDate,
      fileId: d.fileId,
      originalName: d.file.originalName,
      sizeBytes: d.file.sizeBytes,
      companyCode: d.company.code,
      version: d.version,
      createdAt: d.createdAt,
    })),
    total,
    query,
  );
}

export async function documentTypes() {
  return prisma.documentType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, key: true, name: true, requiresExpiry: true, appliesTo: true },
  });
}

/**
 * The types that may be attached to ONE kind of entity.
 *
 * `appliesTo` has always existed; nothing filtered on it, which was harmless
 * while almost every seeded type was employee-only. It stops being harmless
 * the moment the catalogue covers vehicles, suppliers and bills too — an
 * employee upload would offer "Istimara" and a bill would offer "Passport".
 * Filtering in the query rather than the component keeps the wrong options out
 * of the payload as well as off the screen.
 */
export async function documentTypesFor(entityType: EntityType) {
  return prisma.documentType.findMany({
    where: { appliesTo: { has: entityType } },
    orderBy: { name: "asc" },
    select: { id: true, key: true, name: true, requiresExpiry: true },
  });
}

export type CreateDocumentInput = {
  fileId: string;
  documentTypeId: string;
  entityType: EntityType;
  entityId: string;
  companyId: string;
  title: string;
  documentNo?: string | undefined;
  issueDate?: Date | undefined;
  expiryDate?: Date | undefined;
  issuedBy?: string | undefined;
  notes?: string | undefined;
  /** When set, this document replaces that one (renewal chain). */
  supersedesId?: string | undefined;
};

export async function createDocument(ctx: ActorContext, input: CreateDocumentInput) {
  requireCompanyAccess(ctx, input.companyId);

  // The file must exist, be verified, and not already be attached — otherwise
  // one upload could be claimed by two documents.
  const file = await prisma.fileObject.findUnique({
    where: { id: input.fileId },
    select: { id: true, scanStatus: true, originalName: true },
  });
  if (!file || file.scanStatus !== "CLEAN") {
    throw new NotFoundError("Uploaded file not found or not verified.");
  }

  const alreadyUsed = await prisma.document.findFirst({
    where: { fileId: input.fileId },
    select: { id: true },
  });
  if (alreadyUsed) throw new ConflictError("That file is already attached to a document.");

  const type = await prisma.documentType.findUnique({
    where: { id: input.documentTypeId },
    select: { id: true, name: true, requiresExpiry: true, defaultWarningDays: true },
  });
  if (!type) throw new NotFoundError("Document type not found.");
  if (type.requiresExpiry && !input.expiryDate) {
    throw new ConflictError(`${type.name} requires an expiry date.`);
  }

  return prisma.$transaction(async (tx) => {
    const previousVersion = input.supersedesId
      ? await tx.document.findUnique({
          where: { id: input.supersedesId },
          select: { id: true, version: true },
        })
      : null;

    const document = await tx.document.create({
      data: {
        companyId: input.companyId,
        documentTypeId: input.documentTypeId,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        documentNo: input.documentNo ?? null,
        fileId: input.fileId,
        issueDate: input.issueDate ?? null,
        expiryDate: input.expiryDate ?? null,
        issuedBy: input.issuedBy ?? null,
        notes: input.notes ?? null,
        version: (previousVersion?.version ?? 0) + 1,
        supersedesId: previousVersion?.id ?? null,
        uploadedById: ctx.userId,
      },
      select: {
        id: true,
        title: true,
        expiryDate: true,
        companyId: true,
        entityType: true,
        entityId: true,
      },
    });

    // A renewal retires the old projection row rather than deleting it, so the
    // history stays inspectable.
    if (previousVersion) {
      await deactivateExpiry("DOCUMENT", previousVersion.id, tx);
    }

    if (document.expiryDate) {
      await syncExpiry(
        {
          source: "DOCUMENT",
          sourceId: document.id,
          label: document.title,
          expiryDate: document.expiryDate,
          companyId: document.companyId,
          employeeId: document.entityType === "EMPLOYEE" ? document.entityId : null,
          warningDays: type.defaultWarningDays,
        },
        tx,
      );
    }

    return document;
  });
}

export async function getDocument(ctx: ActorContext, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      title: true,
      fileId: true,
      companyId: true,
      entityType: true,
      entityId: true,
      expiryDate: true,
      file: { select: { fileKey: true, originalName: true } },
    },
  });
  if (!document) throw new NotFoundError("Document not found.");
  return document;
}

/**
 * Soft-deletes a document and removes the stored object.
 *
 * The row is retained (deletedAt) so the audit trail still resolves what was
 * deleted, but the bytes are destroyed — keeping a passport scan around after
 * someone deleted it would defeat the point.
 */
export async function deleteDocument(ctx: ActorContext, id: string) {
  const document = await getDocument(ctx, id);

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await deactivateExpiry("DOCUMENT", id, tx);
  });

  await deleteStoredFile(document.file.fileKey);
  return document;
}

// --- Upload / download support ----------------------------------------------
// Route handlers call these rather than touching Prisma themselves, so the
// layering rule in eslint.config.mjs holds for src/app/** without exception.

/**
 * Confirms an upload target exists and the actor may reach it.
 * Returns false rather than throwing, so the caller can raise the error type
 * its framework expects.
 */
export async function isUploadTargetInScope(
  ctx: ActorContext,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const scope = ctx.companyScope === "ALL" ? null : [...ctx.companyScope];
  const inScope = (companyId: string) => scope === null || scope.includes(companyId);

  switch (entityType) {
    case "EMPLOYEE": {
      const row = await prisma.employee.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "COMPANY": {
      const row = await prisma.company.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      return row !== null && inScope(entityId);
    }
    case "VEHICLE": {
      const row = await prisma.vehicle.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "IT_ASSET": {
      const row = await prisma.iTAsset.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }

    // Every case below resolves the OWNING COMPANY and checks it. That is the
    // whole job of this function: without it an upload could be attached to
    // another company's record by guessing an id, and the document would then
    // be readable by everyone who can see that record.

    case "CONTRACT": {
      const row = await prisma.contract.findUnique({
        where: { id: entityId },
        select: { employee: { select: { companyId: true } } },
      });
      return row !== null && inScope(row.employee.companyId);
    }
    case "JOB_OFFER": {
      const row = await prisma.jobOffer.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "ACCOMMODATION": {
      const row = await prisma.accommodation.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "SUPPLIER": {
      // Suppliers may be shared across companies: a null companyId is visible
      // to everyone, which is the same rule listSuppliers applies.
      const row = await prisma.supplier.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      if (row === null) return false;
      return row.companyId === null || inScope(row.companyId);
    }
    case "SUBCONTRACTOR": {
      // A subcontractor carries no company; its contracts do. Reachable when
      // any of those contracts is in scope.
      const row = await prisma.subcontractor.findFirst({
        where: {
          id: entityId,
          ...(scope === null ? {} : { contracts: { some: { companyId: { in: scope } } } }),
        },
        select: { id: true },
      });
      return row !== null;
    }
    case "ELECTRICITY_BILL": {
      const row = await prisma.electricityBill.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "COMPANY_CERTIFICATE": {
      const row = await prisma.companyCertificate.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "MEDICAL_INSURANCE_POLICY": {
      const row = await prisma.medicalInsurancePolicy.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      return row !== null && inScope(row.companyId);
    }
    case "VEHICLE_MAINTENANCE": {
      const row = await prisma.vehicleMaintenance.findUnique({
        where: { id: entityId },
        select: { vehicle: { select: { companyId: true } } },
      });
      return row !== null && inScope(row.vehicle.companyId);
    }

    default:
      return false;
  }
}

/** Records a verified upload. Only called after the magic-byte check passes. */
export async function registerVerifiedFile(input: {
  fileKey: string;
  originalName: string;
  mimeType: string;
  detectedType: string;
  sizeBytes: number;
  uploadedById: string;
}): Promise<{ id: string }> {
  return prisma.fileObject.create({
    data: { ...input, isPrivate: true, scanStatus: "CLEAN" },
    select: { id: true },
  });
}

export type FileAccess = {
  fileKey: string;
  originalName: string;
  mimeType: string;
  entityType: EntityType;
  entityId: string;
  companyId: string | null;
};

/**
 * Resolves a file for download, together with the record that owns it.
 *
 * Returns null for unknown, unverified, and orphaned files alike — the caller
 * reports all three identically so existence cannot be probed.
 */
export async function resolveFileForDownload(fileId: string): Promise<FileAccess | null> {
  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
    select: {
      fileKey: true,
      originalName: true,
      mimeType: true,
      scanStatus: true,
    },
  });
  if (!file || file.scanStatus !== "CLEAN") return null;

  const document = await prisma.document.findFirst({
    where: { fileId, deletedAt: null },
    select: { entityType: true, entityId: true, companyId: true },
  });
  if (document) {
    return {
      fileKey: file.fileKey,
      originalName: file.originalName,
      mimeType: file.mimeType,
      entityType: document.entityType,
      entityId: document.entityId,
      companyId: document.companyId,
    };
  }

  const attachment = await prisma.attachment.findFirst({
    where: { fileId },
    select: { entityType: true, entityId: true },
  });
  if (attachment) {
    return {
      fileKey: file.fileKey,
      originalName: file.originalName,
      mimeType: file.mimeType,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      companyId: null,
    };
  }

  // Uploaded but never attached: unreachable by design.
  return null;
}

/** Documents attached to one record — powers the employee Documents tab. */
export async function documentsForEntity(
  ctx: ActorContext,
  entityType: EntityType,
  entityId: string,
) {
  return prisma.document.findMany({
    where: { entityType, entityId, supersededBy: null, ...companyScopeWhere(ctx) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      documentNo: true,
      issueDate: true,
      expiryDate: true,
      fileId: true,
      version: true,
      createdAt: true,
      documentType: { select: { name: true } },
      file: { select: { originalName: true, sizeBytes: true, mimeType: true } },
    },
  });
}


/**
 * Identifies the record a document library belongs to.
 *
 * Returns the owning company and something a human recognises, or null when
 * the record does not exist OR is out of the caller's scope — the two are
 * deliberately indistinguishable, so probing ids tells an attacker nothing.
 *
 * Scope is enforced by the query itself rather than by filtering afterwards:
 * a fetch-then-check leaves the row in memory and one refactor away from being
 * returned.
 */
/**
 * The company a document gets stamped with when its subject has none.
 *
 * `Document.companyId` is required — it is what every read scopes on — but a
 * few records genuinely belong to no single company: a supplier shared across
 * both entities, or a subcontractor with no contracts yet. Those would
 * otherwise be unable to hold documents at all.
 *
 * Preference order: the record's own company, then the actor's (which is their
 * only company when they have one), then the first by code. The last is
 * arbitrary but deterministic, and it is a real limitation worth knowing: a
 * document stamped this way is visible to that company's users, not to the
 * other entity's. Attach such paperwork to a company-owned record where the
 * distinction matters.
 */
async function stampingCompanyId(
  ctx: ActorContext,
  own: string | null | undefined,
): Promise<string | null> {
  if (own) return own;

  const mine = defaultCompanyId(ctx);
  if (mine) return mine;

  const first = await prisma.company.findFirst({
    orderBy: { code: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export async function resolveDocumentSubject(
  ctx: ActorContext,
  entityType: UploadEntityType,
  entityId: string,
): Promise<{ companyId: string; label: string; backHref: string } | null> {
  const scope = companyScopeWhere(ctx);

  switch (entityType) {
    case "EMPLOYEE": {
      const r = await prisma.employee.findFirst({
        where: { id: entityId, deletedAt: null, ...scope },
        select: { companyId: true, fullName: true, employeeNo: true },
      });
      return r && {
        companyId: r.companyId,
        label: `${r.fullName} (${r.employeeNo})`,
        backHref: `/people/employees/${entityId}`,
      };
    }
    case "COMPANY": {
      const r = await prisma.company.findFirst({
        where: { id: entityId, ...(ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } }) },
        select: { id: true, name: true },
      });
      return r && { companyId: r.id, label: r.name, backHref: "/settings/companies" };
    }
    case "VEHICLE": {
      const r = await prisma.vehicle.findFirst({
        where: { id: entityId, deletedAt: null, ...scope },
        select: { companyId: true, plateNumber: true, make: true, model: true },
      });
      return r && {
        companyId: r.companyId,
        label: `${r.make} ${r.model} — ${r.plateNumber}`,
        backHref: `/vehicles/${entityId}`,
      };
    }
    case "VEHICLE_MAINTENANCE": {
      const r = await prisma.vehicleMaintenance.findFirst({
        where: { id: entityId, vehicle: scope },
        select: {
          date: true,
          type: true,
          vehicle: { select: { companyId: true, plateNumber: true } },
        },
      });
      return r && {
        companyId: r.vehicle.companyId,
        label: `${r.vehicle.plateNumber} — ${r.type} on ${r.date.toISOString().slice(0, 10)}`,
        backHref: "/vehicles/maintenance",
      };
    }
    case "IT_ASSET": {
      const r = await prisma.iTAsset.findFirst({
        where: { id: entityId, deletedAt: null, ...scope },
        select: { companyId: true, assetCode: true, brand: true, model: true },
      });
      return r && {
        companyId: r.companyId,
        label: `${r.brand} ${r.model} (${r.assetCode})`,
        backHref: `/it/assets/${entityId}`,
      };
    }
    case "CONTRACT": {
      // Contract carries its own companyId, so scope applies directly rather
      // than through the employee.
      const r = await prisma.contract.findFirst({
        where: { id: entityId, deletedAt: null, ...scope },
        select: {
          companyId: true,
          contractType: true,
          employee: { select: { fullName: true } },
        },
      });
      return r && {
        companyId: r.companyId,
        label: `${r.employee.fullName} — ${r.contractType.replace(/_/g, " ").toLowerCase()}`,
        backHref: "/hr/contracts",
      };
    }
    case "JOB_OFFER": {
      const r = await prisma.jobOffer.findFirst({
        where: { id: entityId, ...scope },
        select: { companyId: true, candidateName: true },
      });
      return r && {
        companyId: r.companyId,
        label: r.candidateName,
        backHref: "/hr/offers",
      };
    }
    case "ACCOMMODATION": {
      const r = await prisma.accommodation.findFirst({
        where: { id: entityId, ...scope },
        select: { companyId: true, name: true },
      });
      return r && {
        companyId: r.companyId,
        label: r.name,
        backHref: `/admin/accommodation/${entityId}`,
      };
    }
    case "SUPPLIER": {
      const r = await prisma.supplier.findFirst({
        where: { id: entityId, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
        select: { companyId: true, name: true, code: true },
      });
      if (!r) return null;
      const companyId = await stampingCompanyId(ctx, r.companyId);
      return companyId
        ? { companyId, label: `${r.name} (${r.code})`, backHref: "/admin/suppliers" }
        : null;
    }
    case "SUBCONTRACTOR": {
      const r = await prisma.subcontractor.findFirst({
        where: { id: entityId, deletedAt: null },
        select: {
          name: true,
          code: true,
          contracts: { where: scope, select: { companyId: true }, take: 1 },
        },
      });
      if (!r) return null;
      // A subcontractor with no contracts yet reaches no company of its own.
      const companyId = await stampingCompanyId(ctx, r.contracts[0]?.companyId);
      return companyId
        ? {
            companyId,
            label: `${r.name} (${r.code})`,
            backHref: `/admin/subcontractors/${entityId}`,
          }
        : null;
    }
    case "ELECTRICITY_BILL": {
      const r = await prisma.electricityBill.findFirst({
        where: { id: entityId, ...scope },
        select: { companyId: true, location: true, meterNumber: true },
      });
      return r && {
        companyId: r.companyId,
        label: `${r.location} — meter ${r.meterNumber}`,
        backHref: "/admin/electricity-bills",
      };
    }
    case "COMPANY_CERTIFICATE": {
      const r = await prisma.companyCertificate.findFirst({
        where: { id: entityId, ...scope },
        select: {
          companyId: true,
          certificateNo: true,
          certificateType: { select: { name: true } },
        },
      });
      return r && {
        companyId: r.companyId,
        label: `${r.certificateType.name} — ${r.certificateNo}`,
        backHref: "/admin/certificates",
      };
    }
    case "MEDICAL_INSURANCE_POLICY": {
      const r = await prisma.medicalInsurancePolicy.findFirst({
        where: { id: entityId, ...scope },
        select: { companyId: true, policyNumber: true },
      });
      return r && {
        companyId: r.companyId,
        label: `Policy ${r.policyNumber}`,
        backHref: "/insurance",
      };
    }
  }
}
