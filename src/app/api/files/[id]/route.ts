import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { recordAudit } from "@/server/audit/log";
import { logger } from "@/server/logger";
import { resolveFileForDownload } from "@/server/services/documents";
import { signedUrlFor } from "@/server/storage/uploadthing";

export const runtime = "nodejs";

/**
 * The ONLY route through which a stored file may be reached — SECURITY.md §6.4.
 *
 * Files are private in storage, so a leaked id is useless without passing every
 * check below. No storage URL is ever rendered into a page or persisted; one is
 * minted here, per request, and lives 60 seconds.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
    url = await signedUrlFor(file.fileKey);
  } catch (error) {
    logger.error("Could not mint signed URL", {
      fileId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return deny(502, "The file store is unavailable.");
  }

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
      // Stops the signed URL leaking through a referrer header.
      "Referrer-Policy": "no-referrer",
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
