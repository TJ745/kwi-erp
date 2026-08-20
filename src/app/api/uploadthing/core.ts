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
import { getEnv } from "@/lib/env";
import { storageDisclosure } from "@/lib/storage-policy";
import {
  assertStorageAclPolicy,
  assertStorageUsable,
  deleteStoredFile,
  storageTier,
  verifyStoredFileBytes,
} from "@/server/storage/uploadthing";

const f = createUploadthing();

/**
 * Upload routes — ADR-008 / docs/SECURITY.md §6.
 *
 * The security-critical ordering:
 *   middleware       → authenticate + authorise BEFORE any bytes are accepted
 *   (browser upload) → straight to storage; ACL depends on the tier (§6.0)
 *   onUploadComplete → magic-byte verification; on failure the object is
 *                      deleted and NO FileObject row is created, so the
 *                      application treats the file as never having existed.
 */

const uploadInput = z.object({
  entityType: z.enum(["EMPLOYEE", "COMPANY", "VEHICLE", "IT_ASSET"]),
  entityId: z.string().min(1),
});

/**
 * Route configuration, built from the storage tier so the boot assertion can
 * derive the ACLs from the same object the router actually uses. Passing
 * literals to the assertion would make it decorative — it could never catch a
 * route someone later added with the wrong ACL.
 *
 * On the pro tier every route is `acl: "private"`. On the free tier the ACL is
 * OMITTED, because the free plan rejects an explicit ACL with HTTP 400 and
 * every upload would fail. See docs/SECURITY.md §6.0 for the accepted risk.
 */
const TIER = storageTier();

const SIZES = {
  pdf: "16MB",
  image: "8MB",
  doc: "16MB",
} as const;

/** UploadThing types maxFileSize as a template literal, so this stays narrow. */
type Size = (typeof SIZES)[keyof typeof SIZES];
type RouteLimits = { maxFileSize: Size; maxFileCount: 5; acl?: "private" };

function limits(maxFileSize: Size): RouteLimits {
  // The key is omitted rather than set to undefined: under
  // exactOptionalPropertyTypes those are different, and UploadThing serialises
  // a present-but-undefined acl into the request.
  return TIER === "pro"
    ? { maxFileSize, maxFileCount: 5, acl: "private" }
    : { maxFileSize, maxFileCount: 5 };
}

const DOCUMENT_ROUTE_CONFIG = {
  pdf: limits(SIZES.pdf),
  image: limits(SIZES.image),
  "application/msword": limits(SIZES.doc),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": limits(SIZES.doc),
  "application/vnd.ms-excel": limits(SIZES.doc),
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": limits(SIZES.doc),
};

// Fails the module load — and so the whole app — if the declarations do not
// match the tier in either direction.
assertStorageAclPolicy(
  TIER,
  Object.values(DOCUMENT_ROUTE_CONFIG).map((c) => ("acl" in c ? c.acl : undefined)),
);

// Stated at every boot, at a level that reflects whether the exposure has been
// accepted in configuration. See storageDisclosure for why an accepted risk is
// info rather than warn.
const disclosure = storageDisclosure({
  tier: TIER,
  accepted: getEnv().ACCEPT_PUBLIC_FILE_STORAGE,
});
if (disclosure) logger[disclosure.level](disclosure.message);

export const omsFileRouter = {
  documentUploader: f(DOCUMENT_ROUTE_CONFIG, { awaitServerData: true })
    .input(uploadInput)
    .middleware(async ({ input, files }) => {
      // 0. Refuse to accept files at all if public storage was not accepted
      //    for this environment. Per-request, so it cannot fail a build.
      assertStorageUsable();

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
