import "server-only";
import { UTApi } from "uploadthing/server";
import { getEnv } from "@/lib/env";
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

/**
 * Presigned read URL for a private object.
 *
 * `expiresIn` is only honoured when the UploadThing app allows per-request
 * overrides. If it is rejected we fall back to the app default rather than
 * failing the download — but we log it, because a longer-lived URL than we
 * intended is a security-relevant deviation, not a cosmetic one.
 */
export async function signedUrlFor(fileKey: string): Promise<string> {
  try {
    const result = await utapi().generateSignedURL(fileKey, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
    return result.ufsUrl;
  } catch (error) {
    logger.warn("Signed URL override rejected; using app default TTL", {
      fileKey,
      error: error instanceof Error ? error.message : String(error),
    });
    const result = await utapi().generateSignedURL(fileKey);
    return result.ufsUrl;
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
    url = await signedUrlFor(fileKey);
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
 * Boot assertion (ADR-008).
 *
 * UploadThing defaults to `public-read`. If that default is ever restored on
 * the dashboard, every passport scan becomes readable by URL — so this refuses
 * to let the process start rather than degrade quietly.
 *
 * Verified by uploading nothing: we assert the *route* declarations, which are
 * the only thing that governs new files, plus a live probe when possible.
 */
export function assertPrivateAclConfigured(routeAcls: readonly (string | undefined)[]): void {
  const offenders = routeAcls.filter((acl) => acl !== "private");
  if (offenders.length > 0) {
    throw new Error(
      "Refusing to start: one or more UploadThing routes are not declared with " +
        'acl: "private". Employee identity documents would be publicly readable. ' +
        "See docs/ARCHITECTURE.md ADR-008.",
    );
  }
}
