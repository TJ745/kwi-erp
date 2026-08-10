/**
 * File type validation — docs/SECURITY.md §6.
 *
 * Extension and MIME are both attacker-controlled, so neither is trusted on its
 * own. The authoritative check is the magic-byte sniff, which happens after the
 * upload (the browser uploads directly to storage, so we cannot inspect the
 * bytes first) and deletes the object on mismatch.
 */

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** 10 MB default; spreadsheets get more headroom for bulk imports. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<AllowedExtension, readonly string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

/**
 * Byte signatures, checked at a given offset.
 *
 * `zip` covers docx and xlsx: both are ZIP containers, so magic bytes prove
 * "this is a ZIP", not "this is specifically a .docx". That is a real limit of
 * signature checking, recorded here rather than glossed over — the container is
 * still not an executable, which is what the check exists to prevent.
 */
type Signature = { bytes: readonly number[]; offset?: number };

const SIGNATURES: Record<string, readonly Signature[]> = {
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  jpeg: [{ bytes: [0xff, 0xd8, 0xff] }],
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  webp: [
    // "RIFF" .... "WEBP"
    { bytes: [0x52, 0x49, 0x46, 0x46] },
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  ],
  // Legacy Office (OLE2 compound document) — .doc and .xls
  ole2: [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  // ZIP container — .docx and .xlsx
  zip: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
};

/** Which signature family each extension must match. */
const FAMILY_BY_EXTENSION: Record<AllowedExtension, keyof typeof SIGNATURES> = {
  pdf: "pdf",
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  doc: "ole2",
  xls: "ole2",
  docx: "zip",
  xlsx: "zip",
};

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export function maxBytesFor(ext: string): number {
  return ext === "xlsx" || ext === "xls" ? MAX_SPREADSHEET_BYTES : MAX_FILE_BYTES;
}

export type ValidationResult =
  | { ok: true; extension: AllowedExtension; family: string }
  | { ok: false; reason: string };

/** Pre-upload checks: name, extension, declared MIME, size. */
export function validateFileMetadata(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): ValidationResult {
  const ext = extensionOf(input.fileName);

  if (!isAllowedExtension(ext)) {
    return { ok: false, reason: `Files of type ".${ext || "unknown"}" are not accepted.` };
  }
  // SVG is executable markup and is rejected outright, never merely sanitised.
  if (input.mimeType === "image/svg+xml") {
    return { ok: false, reason: "SVG files are not accepted." };
  }
  if (!MIME_BY_EXTENSION[ext].includes(input.mimeType)) {
    return { ok: false, reason: "The file content type does not match its extension." };
  }
  if (input.sizeBytes <= 0) {
    return { ok: false, reason: "The file is empty." };
  }
  if (input.sizeBytes > maxBytesFor(ext)) {
    const mb = Math.round(maxBytesFor(ext) / (1024 * 1024));
    return { ok: false, reason: `Files must be ${String(mb)} MB or smaller.` };
  }

  return { ok: true, extension: ext, family: FAMILY_BY_EXTENSION[ext] };
}

/**
 * The authoritative check: do the actual bytes match the claimed type?
 *
 * Needs only the first ~16 bytes, so callers fetch a Range header rather than
 * downloading the whole object.
 */
export function matchesMagicBytes(bytes: Uint8Array, extension: AllowedExtension): boolean {
  const family = FAMILY_BY_EXTENSION[extension];
  const signatures = SIGNATURES[family];
  if (!signatures) return false;

  return signatures.every((signature) => {
    const offset = signature.offset ?? 0;
    if (bytes.length < offset + signature.bytes.length) return false;
    return signature.bytes.every((byte, index) => bytes[offset + index] === byte);
  });
}

/** How many leading bytes must be read to validate any supported type. */
export const MAGIC_BYTE_PREFIX_LENGTH = 16;

/**
 * Storage key. The user's filename is never used as a path — it is attacker
 * controlled and could contain traversal sequences or a second extension.
 */
export function buildStorageName(entityType: string, entityId: string, ext: string): string {
  const safeEntity = entityType.toLowerCase().replace(/[^a-z_]/g, "");
  const safeId = entityId.replace(/[^a-zA-Z0-9]/g, "");
  return `${safeEntity}/${safeId}/${Date.now().toString(36)}.${ext}`;
}
