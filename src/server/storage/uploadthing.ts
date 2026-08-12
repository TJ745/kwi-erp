import "server-only";
import { UTApi } from "uploadthing/server";
import { getEnv } from "@/lib/env";
import { assertStorageTierAllowed, type StorageTier } from "@/lib/storage-policy";
import { logger } from "@/server/logger";
import {
  MAGIC_BYTE_PREFIX_LENGTH,
  matchesMagicBytes,
  type AllowedExtension,
} from "@/lib/file-validation";

/**
 * Storage adapter — ADR-008.
 *
 * Kept behind this module so a future move to a regional S3 bucket (the PDPL
 * question flagged for the product owner) is a contained change rather than a
 * rewrite of every call site.
 */

let client: UTApi | undefined;

export function utapi(): UTApi {
  client ??= new UTApi({ token: getEnv().UPLOADTHING_TOKEN });
  return client;
}

/** Short-lived by policy: long enough to fetch, too short to pass around. */
export const SIGNED_URL_TTL_SECONDS = 60;

export type { StorageTier };

export function storageTier(): StorageTier {
  return getEnv().UPLOADTHING_TIER;
}

/**
 * Per-request gate on serving or accepting files. Called from the upload
 * middleware and the download route — both of which only execute on a real
 * request, so this cannot fail a build (see lib/storage-policy.ts).
 */
export function assertStorageUsable(): void {
  const env = getEnv();
  assertStorageTierAllowed({
    nodeEnv: env.NODE_ENV,
    tier: env.UPLOADTHING_TIER,
    accepted: env.ACCEPT_PUBLIC_FILE_STORAGE,
  });
}

/**
 * A read URL for a stored object, for SERVER-SIDE use only.
 *
 * This value must never reach the browser. On the free tier the object is
 * world-readable, so the URL is the only thing standing between a passport scan
 * and the internet; on the pro tier it is a signed URL that should still not be
 * handed out. `/api/files/[id]` streams the bytes through the server rather
 * than redirecting, so no caller has a reason to want this.
 *
 * A signed URL is attempted on both tiers. Signing is local (no round trip) and
 * an expiring URL is strictly better than the canonical public one even when
 * the object is public — it is not the address an attacker would guess at.
 */
export async function readUrlFor(fileKey: string): Promise<string> {
  try {
    const result = await utapi().generateSignedURL(fileKey, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
    return result.ufsUrl;
  } catch (error) {
    // A longer-lived URL than intended is a security-relevant deviation, not a
    // cosmetic one, so it is logged either way.
    logger.warn("Signed URL with TTL rejected; retrying with the app default", {
      fileKey,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const result = await utapi().generateSignedURL(fileKey);
      return result.ufsUrl;
    } catch (fallbackError) {
      if (storageTier() === "pro") throw fallbackError;

      // Free tier only: signing is unavailable for public objects on some
      // plans. The object is world-readable regardless, so this changes the
      // exposure not at all — but it is logged so it is never a silent
      // downgrade from an expiring URL to a permanent one.
      logger.warn("Falling back to the unsigned public URL (free tier)", { fileKey });
      const listed = await utapi().getFileUrls(fileKey);
      const url = listed.data[0]?.url;
      if (!url) throw fallbackError;
      return url;
    }
  }
}

export async function deleteStoredFile(fileKey: string): Promise<void> {
  try {
    await utapi().deleteFiles(fileKey);
  } catch (error) {
    // Worth surfacing: a failed delete leaves an orphaned object that the
    // application can no longer reach or clean up.
    logger.error("Failed to delete stored file", {
      fileKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The authoritative post-upload check (SECURITY.md §6.2).
 *
 * Reads only the leading bytes via a Range request — the file may be 25 MB and
 * we need 16 of them.
 */
export async function verifyStoredFileBytes(
  fileKey: string,
  extension: AllowedExtension,
): Promise<{ ok: boolean; reason?: string }> {
  let url: string;
  try {
    url = await readUrlFor(fileKey);
  } catch (error) {
    return {
      ok: false,
      reason: `Could not read the uploaded file back: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  const response = await fetch(url, {
    headers: { Range: `bytes=0-${String(MAGIC_BYTE_PREFIX_LENGTH - 1)}` },
  });

  if (!response.ok && response.status !== 206) {
    return { ok: false, reason: `Storage returned ${String(response.status)}` };
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.length < 4) {
    return { ok: false, reason: "File is too small to be a valid document" };
  }

  return matchesMagicBytes(buffer, extension)
    ? { ok: true }
    : { ok: false, reason: "File content does not match its declared type" };
}

/**
 * Boot assertion (ADR-008) — the implementation lives in `lib/storage-policy.ts`
 * so it can be unit-tested; re-exported here because this is where callers
 * expect storage concerns to live.
 */
export { assertStorageAclPolicy } from "@/lib/storage-policy";
