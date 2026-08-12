import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { recordAudit } from "@/server/audit/log";
import { logger } from "@/server/logger";
import { resolveFileForDownload } from "@/server/services/documents";
import { assertStorageUsable, readUrlFor } from "@/server/storage/uploadthing";

export const runtime = "nodejs";

/**
 * The ONLY route through which a stored file may be reached — SECURITY.md §6.4.
 *
 * A leaked file id is useless without passing every check below. The bytes are
 * STREAMED through this handler rather than redirected to, so the storage URL
 * never reaches the browser at all — which is what makes the free tier's
 * world-readable objects tolerable (SECURITY.md §6.0). No storage URL is ever
 * rendered into a page or persisted.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // Refuses to serve from public storage in production unless that was
  // explicitly accepted. Per-request by design — the same check in env parsing
  // fails `next build`, which runs with NODE_ENV=production.
  try {
    assertStorageUsable();
  } catch (error) {
    logger.error("Storage tier not permitted in this environment", {
      error: error instanceof Error ? error.message : String(error),
    });
    return deny(503, "File storage is not configured for this environment.");
  }

  const ctx = await getActorContext();
  if (!ctx) return deny(401, "Not signed in.");

  try {
    await consumeRateLimit("fileDownload", ctx.userId);
  } catch {
    return deny(429, "Too many downloads. Please wait a moment.");
  }

  const { id } = await context.params;
  const file = await resolveFileForDownload(id);

  // Unknown, unverified, and orphaned files all report identically.
  if (!file) return deny(404, "File not found.");

  if (!ctx.permissions.has("documents.download")) return deny(404, "File not found.");

  if (
    file.companyId &&
    ctx.companyScope !== "ALL" &&
    !ctx.companyScope.includes(file.companyId)
  ) {
    return deny(404, "File not found.");
  }

  let url: string;
  try {
    url = await readUrlFor(file.fileKey);
  } catch (error) {
    logger.error("Could not resolve a storage URL", {
      fileId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return deny(502, "The file store is unavailable.");
  }

  // Streamed through the server, never redirected to.
  //
  // This is what keeps the storage URL out of the browser entirely — no
  // Location header, no history entry, no referrer, nothing in devtools. It
  // matters most on the free tier, where the object is world-readable and the
  // URL is therefore the only thing protecting it (docs/SECURITY.md §6.0).
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) return deny(502, "The file could not be retrieved.");

  await recordAudit(ctx, {
    action: "DOWNLOAD",
    entityType: file.entityType,
    entityId: file.entityId,
    companyId: file.companyId,
    summary: `Downloaded file "${file.originalName}"`,
  });

  const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${sanitiseFilename(
        file.originalName,
      )}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // No Referrer-Policy override here: next.config.ts sets one globally and
      // wins, so a stricter value declared at this level would be silently
      // ignored — a header that looks like a control but is not. The storage
      // URL never reaches the browser anyway, since this streams rather than
      // redirects.
    },
  });
}

/** Prevents header injection and directory hints via the filename. */
function sanitiseFilename(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 120);
}

function deny(status: number, message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
