import { createUploadthing, UploadThingError, type FileRouter } from "uploadthing/server";
import { z } from "zod";
import {
  extensionOf,
  isAllowedExtension,
  MAX_FILE_BYTES,
  validateFileMetadata,
} from "@/lib/file-validation";
import { requirePermission } from "@/server/auth/guards";
import { logger } from "@/server/logger";
import { isUploadTargetInScope, registerVerifiedFile } from "@/server/services/documents";
import {
  assertPrivateAclConfigured,
  deleteStoredFile,
  verifyStoredFileBytes,
} from "@/server/storage/uploadthing";

const f = createUploadthing();

/**
 * Upload routes — ADR-008 / docs/SECURITY.md §6.
 *
 * The security-critical ordering:
 *   middleware       → authenticate + authorise BEFORE any bytes are accepted
 *   (browser upload) → straight to storage, private ACL
 *   onUploadComplete → magic-byte verification; on failure the object is
 *                      deleted and NO FileObject row is created, so the
 *                      application treats the file as never having existed.
 */

const uploadInput = z.object({
  entityType: z.enum(["EMPLOYEE", "COMPANY", "VEHICLE", "IT_ASSET"]),
  entityId: z.string().min(1),
});

/**
 * Route configuration, declared as a named constant so the boot assertion can
 * derive the ACLs from the same object the router actually uses. Passing
 * literals to the assertion would make it decorative — it could never catch a
 * route someone later added without `acl: "private"`.
 */
const DOCUMENT_ROUTE_CONFIG = {
  pdf: { maxFileSize: "16MB", maxFileCount: 5, acl: "private" },
  image: { maxFileSize: "8MB", maxFileCount: 5, acl: "private" },
  "application/msword": { maxFileSize: "16MB", maxFileCount: 5, acl: "private" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    maxFileSize: "16MB",
    maxFileCount: 5,
    acl: "private",
  },
  "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 5, acl: "private" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    maxFileSize: "16MB",
    maxFileCount: 5,
    acl: "private",
  },
} as const;

// Fails the module load — and so the whole app — if any route is not private.
assertPrivateAclConfigured(Object.values(DOCUMENT_ROUTE_CONFIG).map((c) => c.acl));

export const omsFileRouter = {
  documentUploader: f(DOCUMENT_ROUTE_CONFIG, { awaitServerData: true })
    .input(uploadInput)
    .middleware(async ({ input, files }) => {
      // 1. Authenticate and authorise before a single byte is accepted.
      const ctx = await requirePermission("documents.upload");

      // 2. Reject disallowed types up front. The bytes are still verified
      //    afterwards; this just avoids paying for an upload we would delete.
      for (const file of files) {
        const check = validateFileMetadata({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (!check.ok) throw new UploadThingError(check.reason);
      }

      // 3. Verify the target exists and is in scope, so an upload cannot be
      //    attached to another company's employee.
      const allowed = await isUploadTargetInScope(ctx, input.entityType, input.entityId);
      if (!allowed) throw new UploadThingError("Record not found.");

      return {
        userId: ctx.userId,
        entityType: input.entityType,
        entityId: input.entityId,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const ext = extensionOf(file.name);

      if (!isAllowedExtension(ext)) {
        await deleteStoredFile(file.key);
        throw new UploadThingError("Rejected: disallowed file type.");
      }

      // The authoritative check. A .exe renamed to .pdf dies here.
      const verdict = await verifyStoredFileBytes(file.key, ext);
      if (!verdict.ok) {
        await deleteStoredFile(file.key);
        logger.warn("Upload rejected after byte verification", {
          fileKey: file.key,
          fileName: file.name,
          userId: metadata.userId,
          reason: verdict.reason,
        });
        throw new UploadThingError("Rejected: file content does not match its type.");
      }

      // Only now does the file become visible to the application.
      const record = await registerVerifiedFile({
        fileKey: file.key,
        originalName: file.name,
        mimeType: file.type,
        detectedType: ext,
        sizeBytes: file.size,
        uploadedById: metadata.userId,
      });

      logger.info("File accepted", {
        fileId: record.id,
        entityType: metadata.entityType,
        entityId: metadata.entityId,
      });

      // Returned to the client so it can attach the file to a Document.
      return { fileId: record.id, originalName: file.name };
    }),
} satisfies FileRouter;

export type OmsFileRouter = typeof omsFileRouter;

// Re-exported so the size limit is stated in exactly one place.
export { MAX_FILE_BYTES };
