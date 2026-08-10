import "server-only";
import type { EntityType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
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
