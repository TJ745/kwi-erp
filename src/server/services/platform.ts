import "server-only";
import type { AuditAction, EntityType } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { DEFAULT_PAGE_SIZE, PRINT_PAGE_SIZE } from "@/lib/list-query";
import type { DocumentTypeInput } from "@/lib/schemas/platform";

/**
 * Platform administration — audit log and document types.
 *
 * The audit log is READ-ONLY here on purpose. Entries are written by the action
 * pipeline (`defineAction`) and by nothing else; a service function that could
 * create, edit, or delete one would make the trail worth less than the paper it
 * is printed on. There is no update or delete in this file for AuditLog, and
 * that absence is the point.
 */

// --- Audit log ---------------------------------------------------------------

export type AuditFilters = {
  action?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorUserId?: string | undefined;
  companyId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  q?: string | undefined;
};

const AUDIT_PAGE_SIZE = DEFAULT_PAGE_SIZE;

/**
 * The single scoping derivation for the audit log.
 *
 * Extracted so the on-screen list and the export cannot drift: an export that
 * scoped differently from the screen is exactly the shape of the Phase 11 leak.
 */
function auditWhere(ctx: ActorContext, filters: AuditFilters) {
  return {
    // Scope and free-text search are composed under AND, never spread side by
    // side. Both emit `OR`, and a second `OR` key replaces the first rather
    // than merging — which left every *searched* audit query unscoped, showing
    // entries from companies the reader cannot otherwise see. The export runs
    // through this same function, so it leaked identically.
    //
    // Entries with no company (platform-level actions) stay visible to
    // everyone who can read the log at all; company-owned ones are scoped.
    AND: [
      optionalCompanyScopeWhere(ctx),
      ...(filters.q
        ? [
            {
              OR: [
                { summary: { contains: filters.q, mode: "insensitive" as const } },
                { actorLabel: { contains: filters.q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.action ? { action: filters.action as AuditAction } : {}),
    ...(filters.entityType ? { entityType: filters.entityType as EntityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };
}

export async function listAuditEntries(
  ctx: ActorContext,
  filters: AuditFilters,
  page = 1,
  pageSize: number = AUDIT_PAGE_SIZE,
) {
  const where = auditWhere(ctx, filters);

  const safePage = Math.max(1, Math.min(page, 1000));
  const size = Math.max(1, Math.min(pageSize, PRINT_PAGE_SIZE));

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * size,
      take: size,
      select: {
        id: true,
        actorLabel: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        companyId: true,
        summary: true,
        changes: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    entries,
    total,
    page: safePage,
    pageSize: size,
    pageCount: Math.max(1, Math.ceil(total / size)),
  };
}

/**
 * The same query as `listAuditEntries`, unpaginated and capped, for export.
 *
 * A separate function rather than a page-size argument so the cap is explicit
 * and cannot be raised by a caller passing a large number. The cap is a real
 * limit, not a nicety: the route reports when it bites so an export is never
 * silently partial.
 */
export const AUDIT_EXPORT_LIMIT = 10_000;

export async function auditEntriesForExport(ctx: ActorContext, filters: AuditFilters) {
  const entries = await prisma.auditLog.findMany({
    where: auditWhere(ctx, filters),
    orderBy: { createdAt: "desc" },
    take: AUDIT_EXPORT_LIMIT + 1,
    select: {
      id: true,
      createdAt: true,
      actorLabel: true,
      action: true,
      entityType: true,
      entityId: true,
      companyId: true,
      summary: true,
      changes: true,
      ipAddress: true,
    },
  });

  const truncated = entries.length > AUDIT_EXPORT_LIMIT;
  return { entries: truncated ? entries.slice(0, AUDIT_EXPORT_LIMIT) : entries, truncated };
}

/** Distinct actors, for the filter dropdown. */
export async function auditActors(ctx: ActorContext) {
  const rows = await prisma.auditLog.findMany({
    where: { ...optionalCompanyScopeWhere(ctx), actorUserId: { not: null } },
    distinct: ["actorUserId"],
    orderBy: { actorLabel: "asc" },
    take: 200,
    select: { actorUserId: true, actorLabel: true },
  });

  return rows
    .filter((r): r is { actorUserId: string; actorLabel: string } => r.actorUserId !== null)
    .map((r) => ({ id: r.actorUserId, label: r.actorLabel }));
}

export async function auditCounts(ctx: ActorContext) {
  const scope = optionalCompanyScopeWhere(ctx);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, today, deletes, exports] = await Promise.all([
    prisma.auditLog.count({ where: scope }),
    prisma.auditLog.count({ where: { ...scope, createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { ...scope, action: "DELETE", createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { ...scope, action: "EXPORT", createdAt: { gte: since } } }),
  ]);

  return { total, today, deletes, exports };
}

// --- Document types ----------------------------------------------------------

export async function listDocumentTypes() {
  return prisma.documentType.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      appliesTo: true,
      requiresExpiry: true,
      defaultWarningDays: true,
      isSystem: true,
      _count: { select: { documents: true } },
    },
  });
}

export async function createDocumentType(_ctx: ActorContext, input: DocumentTypeInput) {
  const clash = await prisma.documentType.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A document type with key "${input.key}" exists.`);

  return prisma.documentType.create({
    data: {
      key: input.key,
      name: input.name,
      appliesTo: input.appliesTo as EntityType[],
      requiresExpiry: input.requiresExpiry,
      defaultWarningDays: input.defaultWarningDays,
      isSystem: false,
    },
    select: { id: true, key: true, name: true },
  });
}

export async function updateDocumentType(
  _ctx: ActorContext,
  input: DocumentTypeInput & { id: string },
) {
  const before = await prisma.documentType.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      key: true,
      name: true,
      isSystem: true,
      requiresExpiry: true,
      appliesTo: true,
      _count: { select: { documents: true } },
    },
  });
  if (!before) throw new NotFoundError("Document type not found.");

  const clash = await prisma.documentType.findFirst({
    where: { key: input.key, id: { not: input.id } },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A document type with key "${input.key}" exists.`);

  // A system type is referenced by seeded logic; renaming it is fine,
  // changing what it means is not.
  const after = await prisma.documentType.update({
    where: { id: input.id },
    data: {
      ...(before.isSystem ? {} : { key: input.key }),
      name: input.name,
      appliesTo: input.appliesTo as EntityType[],
      requiresExpiry: input.requiresExpiry,
      defaultWarningDays: input.defaultWarningDays,
    },
    select: { id: true, key: true, name: true, requiresExpiry: true, appliesTo: true },
  });

  return { before, after };
}

export async function deleteDocumentType(_ctx: ActorContext, id: string) {
  const type = await prisma.documentType.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      name: true,
      isSystem: true,
      _count: { select: { documents: true } },
    },
  });
  if (!type) throw new NotFoundError("Document type not found.");
  if (type.isSystem) {
    throw new ConflictError("System document types cannot be deleted.");
  }
  if (type._count.documents > 0) {
    throw new ConflictError(
      `${type._count.documents} document(s) use this type. Reassign them first.`,
    );
  }

  await prisma.documentType.delete({ where: { id } });
  return type;
}

// --- Documents hub -----------------------------------------------------------

/**
 * Every governed document across the actor's scope.
 *
 * The per-entity tabs answer "what does this employee have"; this answers
 * "what do we hold, and what is about to lapse" — which is the question the
 * administrator actually starts the day with.
 */
export async function listAllDocuments(
  ctx: ActorContext,
  filters: {
    typeId?: string | undefined;
    entityType?: string | undefined;
    q?: string | undefined;
    expiringOnly?: boolean | undefined;
  } = {},
) {
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  return prisma.document.findMany({
    where: {
      deletedAt: null,
      ...companyScopeWhere(ctx),
      ...(filters.typeId ? { documentTypeId: filters.typeId } : {}),
      ...(filters.entityType ? { entityType: filters.entityType as EntityType } : {}),
      ...(filters.expiringOnly ? { expiryDate: { not: null, lte: in60 } } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" as const } },
              { documentNo: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      title: true,
      documentNo: true,
      entityType: true,
      entityId: true,
      issueDate: true,
      expiryDate: true,
      version: true,
      fileId: true,
      companyId: true,
      documentType: { select: { id: true, name: true } },
      company: { select: { code: true } },
      supersedesId: true,
    },
  });
}

export async function documentCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [total, expiring, expired] = await Promise.all([
    prisma.document.count({ where: { deletedAt: null, ...scope } }),
    prisma.document.count({
      where: { deletedAt: null, expiryDate: { gte: now, lte: in60 }, ...scope },
    }),
    prisma.document.count({
      where: { deletedAt: null, expiryDate: { lt: now }, ...scope },
    }),
  ]);

  return { total, expiring, expired };
}
