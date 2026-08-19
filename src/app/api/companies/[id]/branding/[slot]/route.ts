import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { slotFromPathSegment } from "@/lib/letterhead";
import { logger } from "@/server/logger";
import { resolveCompanyBrandingFile } from "@/server/services/org";
import { assertStorageUsable, readUrlFor } from "@/server/storage/uploadthing";

export const runtime = "nodejs";

/**
 * Company letterhead artwork, for rendering on generated documents.
 *
 * Keyed by COMPANY id and slot, never by file id. That is the whole point of a
 * second route: `/api/files/[id]` gates on `documents.download`, which most
 * people who can read a letter do not have, and loosening it there would open
 * every stored document. Here the only reachable bytes are the two images an
 * administrator explicitly designated as letterhead for a company the caller
 * can already see — so a caller cannot name the file they want.
 *
 * Not audited per request. A letterhead loads on every render of every letter;
 * an audit row each time would bury the log without recording anything a reader
 * did not already have. The underlying file, reached through /api/files, is
 * still audited normally.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; slot: string }> },
) {
  try {
    assertStorageUsable();
  } catch (error) {
    logger.error("Storage tier not permitted in this environment", {
      error: error instanceof Error ? error.message : String(error),
    });
    return deny(503);
  }

  const ctx = await getActorContext();
  if (!ctx) return deny(401);

  const { id, slot: segment } = await context.params;
  const slot = slotFromPathSegment(segment);
  if (slot === null) return deny(404);

  // Company scope first: an out-of-scope company is indistinguishable from one
  // with no letterhead set.
  if (ctx.companyScope !== "ALL" && !ctx.companyScope.includes(id)) return deny(404);

  // Returns null unless the file is still letterhead-eligible, so the
  // Content-Type set below can only ever be a verified image type.
  const file = await resolveCompanyBrandingFile(id, slot);
  if (!file) return deny(404);

  let url: string;
  try {
    url = await readUrlFor(file.fileKey);
  } catch (error) {
    logger.error("Could not resolve a storage URL for letterhead", {
      companyId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return deny(502);
  }

  // Streamed, not redirected — same reasoning as /api/files/[id]: the storage
  // URL never reaches the browser (docs/SECURITY.md §6.0).
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) return deny(502);

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Private and short-lived: letterhead changes rarely, but it is scoped to
      // the caller's companies, so it must never land in a shared cache.
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** No body: this is an <img> source, and a JSON error would render as a broken
 *  image either way. Every failure looks the same from outside. */
function deny(status: number): NextResponse {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}
