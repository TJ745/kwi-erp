/**
 * What may become company letterhead, as a decision rather than a code path.
 *
 * Letterhead is the one place where an uploaded file is rendered into a page by
 * the application itself rather than downloaded, so "is this file eligible" is
 * worth stating once, in a form that can be tested exhaustively, instead of
 * spread across a service and a route handler where each half looks reasonable
 * alone.
 */

/** Which piece of letterhead. Two slots, and the set is closed. */
export const LETTERHEAD_SLOTS = ["HEADER", "FOOTER"] as const;
export type LetterheadSlot = (typeof LETTERHEAD_SLOTS)[number];

/**
 * Renderable raster formats only.
 *
 * SVG is absent deliberately, and this is the reason it is written down rather
 * than inherited from the upload allowlist: an SVG is a document that can carry
 * script and external references, and letterhead is the one upload the app
 * renders inline into an authenticated page. It would be the wrong thing to
 * allow here even if uploads started accepting it.
 */
const LETTERHEAD_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Extensions the magic-byte sniff may report for those types. */
const LETTERHEAD_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

/** Maps a URL path segment to a slot, or null if it is not one. */
export function slotFromPathSegment(segment: string): LetterheadSlot | null {
  if (segment === "header") return "HEADER";
  if (segment === "footer") return "FOOTER";
  return null;
}

/** The Company column a slot writes to. */
export function slotColumn(slot: LetterheadSlot): "headerImageFileId" | "footerImageFileId" {
  return slot === "HEADER" ? "headerImageFileId" : "footerImageFileId";
}

/**
 * Whether a stored file may be used as letterhead.
 *
 * Both the declared type and the sniffed type must agree. The declared one is
 * what the browser sent and the sniffed one is what the bytes actually are;
 * requiring both means a mislabelled file fails whichever way it was mislabelled.
 * A file that has not been verified (`scanStatus` other than CLEAN) is never
 * eligible, because until then the row is not supposed to be visible at all.
 */
export function isLetterheadEligible(file: {
  mimeType: string;
  detectedType: string | null;
  scanStatus: string;
}): boolean {
  if (file.scanStatus !== "CLEAN") return false;
  if (!LETTERHEAD_MIME_TYPES.has(file.mimeType)) return false;
  return file.detectedType !== null && LETTERHEAD_EXTENSIONS.has(file.detectedType);
}
