import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { logger } from "@/server/logger";
import { deleteStoredFile } from "@/server/storage/uploadthing";
import {
  monthLabel,
  monthStart,
  TIMESHEET_EXTENSIONS,
  type TimesheetFileInput,
} from "@/lib/schemas/timesheet";

/**
 * Timesheet files: one Excel (or PDF) file per company per month.
 *
 * The file itself goes through the normal verified upload pipeline (the
 * uploader checks permission, type, and magic bytes before a FileObject
 * exists). This module only attaches that verified file to a company + month.
 */

export async function listTimesheetFiles(
  ctx: ActorContext,
  filters: { companyId?: string | undefined; year?: number | undefined } = {},
) {
  const rows = await prisma.timesheetFile.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.year
        ? {
            month: {
              gte: new Date(Date.UTC(filters.year, 0, 1)),
              lt: new Date(Date.UTC(filters.year + 1, 0, 1)),
            },
          }
        : {}),
    },
    orderBy: [{ month: "desc" }, { company: { code: "asc" } }],
    take: 5000,
    select: {
      id: true,
      month: true,
      notes: true,
      createdAt: true,
      uploadedById: true,
      company: { select: { id: true, code: true, name: true } },
      file: { select: { id: true, originalName: true, sizeBytes: true } },
    },
  });

  // uploadedById is a plain column; names are looked up in one query.
  const userIds = [...new Set(rows.map((r) => r.uploadedById))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    month: r.month,
    monthLabel: monthLabel(r.month),
    notes: r.notes,
    uploadedAt: r.createdAt,
    uploadedBy: nameById.get(r.uploadedById) ?? "—",
    company: r.company,
    file: r.file,
  }));
}

/**
 * Every company + month that already has a file, as `companyId:YYYY-MM`.
 * The upload dialog uses it to stop a duplicate before the file is sent,
 * rather than after — which would leave an unattached upload behind.
 */
export async function takenTimesheetMonths(ctx: ActorContext): Promise<string[]> {
  const rows = await prisma.timesheetFile.findMany({
    where: companyScopeWhere(ctx),
    select: { companyId: true, month: true },
  });
  return rows.map((r) => `${r.companyId}:${r.month.toISOString().slice(0, 7)}`);
}

/** Years that have at least one file, newest first, for the year filter. */
export async function timesheetYears(ctx: ActorContext): Promise<number[]> {
  const rows = await prisma.timesheetFile.findMany({
    where: companyScopeWhere(ctx),
    select: { month: true },
    distinct: ["month"],
  });
  return [...new Set(rows.map((r) => r.month.getUTCFullYear()))].sort((a, b) => b - a);
}

export async function createTimesheetFile(ctx: ActorContext, input: TimesheetFileInput) {
  requireCompanyAccess(ctx, input.companyId);
  const month = monthStart(input.month);

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, code: true },
  });
  if (!company) throw new NotFoundError("Company not found.");

  // The file must be a verified upload by this same user, of an accepted type,
  // and not already attached to anything — one upload cannot be claimed twice.
  const file = await prisma.fileObject.findUnique({
    where: { id: input.fileId },
    select: { id: true, scanStatus: true, uploadedById: true, detectedType: true },
  });
  if (!file || file.scanStatus !== "CLEAN" || file.uploadedById !== ctx.userId) {
    throw new NotFoundError("Uploaded file not found. Upload it again.");
  }
  if (!(TIMESHEET_EXTENSIONS as readonly string[]).includes(file.detectedType ?? "")) {
    throw new ConflictError("A timesheet must be an Excel file (.xlsx or .xls) or a PDF.");
  }
  const [asDocument, asAttachment] = await Promise.all([
    prisma.document.findFirst({ where: { fileId: file.id }, select: { id: true } }),
    prisma.attachment.findFirst({ where: { fileId: file.id }, select: { id: true } }),
  ]);
  if (asDocument || asAttachment)
    throw new ConflictError("That file is already attached elsewhere.");

  try {
    const created = await prisma.timesheetFile.create({
      data: {
        companyId: company.id,
        month,
        fileId: file.id,
        notes: input.notes ?? null,
        uploadedById: ctx.userId,
      },
      select: { id: true, companyId: true, month: true },
    });
    return { ...created, companyCode: company.code, monthLabel: monthLabel(created.month) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        `${company.code} already has a timesheet for ${monthLabel(month)}. Delete it first to upload a replacement.`,
      );
    }
    throw error;
  }
}

/**
 * Removes the entry and the stored file with it. The file belongs to nothing
 * else, so keeping it would only leave an unreachable object in storage.
 */
export async function deleteTimesheetFile(ctx: ActorContext, id: string) {
  const row = await prisma.timesheetFile.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      companyId: true,
      month: true,
      company: { select: { code: true } },
      file: { select: { id: true, fileKey: true, originalName: true } },
    },
  });
  if (!row) throw new NotFoundError("Timesheet not found.");

  await prisma.$transaction([
    prisma.timesheetFile.delete({ where: { id } }),
    prisma.fileObject.delete({ where: { id: row.file.id } }),
  ]);

  try {
    await deleteStoredFile(row.file.fileKey);
  } catch (error) {
    // The record is already gone, so the object is unreachable through the
    // app either way; a failed storage delete is logged, not surfaced.
    logger.warn("Could not delete a timesheet file from storage", {
      fileId: row.file.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    id: row.id,
    companyId: row.companyId,
    companyCode: row.company.code,
    monthLabel: monthLabel(row.month),
    fileName: row.file.originalName,
  };
}
