/**
 * Audit redaction — docs/SECURITY.md §7.
 *
 * Applied to every `changes` diff before it is written. The FACT of a change
 * stays auditable; the value never is. A salary or IBAN edit records who
 * changed it and when, never what it was.
 */

export const REDACTED_FIELDS: ReadonlySet<string> = new Set([
  // Credentials and crypto material
  "password",
  "passwordHash",
  "newPassword",
  "currentPassword",
  "ciphertext",
  "notesCipher",
  "wrappedDek",
  "iv",
  "notesIv",
  "authTag",
  "notesAuthTag",
  "secret",
  "apiKey",
  "token",
  "tokenHash",
  "sessionToken",
  "accessToken",
  "refreshToken",
  "idToken",
  // Financial identifiers
  "iban",
  "accountNo",
  "swift",
]);

export const REDACTED_PLACEHOLDER = "[REDACTED]";

function isRedactedKey(key: string): boolean {
  if (REDACTED_FIELDS.has(key)) return true;
  // Catch derived names such as `vaultPassword` or `apiKeyValue`.
  const lower = key.toLowerCase();
  return (
    lower.includes("password") ||
    lower.includes("secret") ||
    lower.includes("ciphertext") ||
    lower.endsWith("token")
  );
}

/** JSON-safe value. Keeps the change set assignable to Prisma's Json input
 *  without a cast, and guarantees nothing unserialisable reaches the database. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type FieldChange = { before: Json; after: Json };
export type ChangeSet = Record<string, FieldChange>;

/**
 * Field-level diff of two records, with sensitive values masked.
 * Only changed fields are included, so the audit row stays small and readable.
 */
export function diffRecords(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): ChangeSet {
  const changes: ChangeSet = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of keys) {
    const prev = before?.[key];
    const next = after?.[key];
    if (isEqual(prev, next)) continue;

    changes[key] = isRedactedKey(key)
      ? { before: REDACTED_PLACEHOLDER, after: REDACTED_PLACEHOLDER }
      : { before: normalise(prev), after: normalise(next) };
  }

  return changes;
}

/** Masks sensitive keys in a flat object without diffing. */
export function redact(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = isRedactedKey(key) ? REDACTED_PLACEHOLDER : normalise(v);
  }
  return out;
}

/**
 * Converts a database value into something JSON-safe.
 *
 * Dates become ISO strings (stable diffs), Decimals and BigInts become strings
 * (no precision loss), and raw bytes are never emitted at all. Depth is capped
 * because audit values are shallow records, and an unbounded walk would be a
 * denial-of-service vector on a malformed Json column.
 */
function normalise(value: unknown, depth = 0): Json {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return REDACTED_PLACEHOLDER;

  const type = typeof value;
  if (type === "string" || type === "boolean") return value as string | boolean;
  if (type === "number") return Number.isFinite(value) ? (value as number) : null;
  if (type === "bigint") return (value as bigint).toString();
  if (type === "function" || type === "symbol") return null;

  if (depth >= 6) return REDACTED_PLACEHOLDER;

  if (Array.isArray(value)) return value.map((item) => normalise(item, depth + 1));

  if (type === "object") {
    const record = value as Record<string, unknown>;

    // Prisma Decimal and similar wrappers expose toFixed. Stringify via their
    // own toString (not Object's) so precision is preserved exactly.
    if (typeof record.toFixed === "function") {
      const decimal = value as { toString: () => string };
      return decimal.toString();
    }

    const out: Record<string, Json> = {};
    for (const [key, v] of Object.entries(record)) {
      out[key] = isRedactedKey(key) ? REDACTED_PLACEHOLDER : normalise(v, depth + 1);
    }
    return out;
  }

  return null;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null || a === undefined || b === undefined) return false;

  // Bytes must be compared BEFORE normalising: normalise() masks every byte
  // array to the same placeholder, so comparing normalised forms would report
  // two different ciphertexts as unchanged and the audit entry would be
  // silently dropped.
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return a.length === b.length && a.every((byte, i) => byte === b[i]);
  }
  if (a instanceof Uint8Array || b instanceof Uint8Array) return false;

  // Structural comparison via the normalised (JSON-safe) form, so Decimals and
  // dates nested inside Json columns compare correctly.
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
  }
  return false;
}
