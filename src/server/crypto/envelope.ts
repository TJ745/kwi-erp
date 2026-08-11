import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Envelope encryption for the credential vault — docs/SECURITY.md §5.1.
 *
 *   KEK (env, never in the database)
 *     └─ wraps a random DEK, unique per credential
 *          └─ encrypts the secret with AES-256-GCM
 *
 * Why envelope rather than encrypting directly under the KEK:
 *   - rotating the KEK re-wraps small DEKs instead of re-encrypting every secret
 *   - a leaked single DEK exposes exactly one credential
 *   - keyVersion per row makes rotation gradual and resumable
 *
 * Keys are passed in explicitly rather than read from the environment, so this
 * module is directly testable and has no import-time side effects.
 */

const ALGORITHM = "aes-256-gcm";
export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const AUTH_TAG_BYTES = 16;

/**
 * Prisma's `Bytes` columns expect `Uint8Array<ArrayBuffer>`, while Node's
 * `Buffer` is `Buffer<ArrayBufferLike>` and is not assignable to it. Callers
 * pass sealed payloads straight into Prisma, so the boundary type is this.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/** Copies a Buffer into a plain, ArrayBuffer-backed Uint8Array. */
export function toBytes(buffer: Buffer | Uint8Array): Bytes {
  return Uint8Array.from(buffer);
}

export type SealedPayload = {
  ciphertext: Bytes;
  iv: Bytes;
  authTag: Bytes;
  /** The DEK, encrypted under the KEK. */
  wrappedDek: Bytes;
};

export class VaultCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultCryptoError";
  }
}

function assertKey(key: Buffer, label: string): void {
  if (key.length !== KEY_BYTES) {
    throw new VaultCryptoError(
      `${label} must be exactly ${String(KEY_BYTES)} bytes, received ${String(key.length)}`,
    );
  }
}

/** One-shot AES-256-GCM encryption with additional authenticated data. */
function encrypt(
  key: Buffer,
  plaintext: Buffer,
  aad: Buffer,
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  // A fresh random IV per encryption. Reusing one under the same key would
  // catastrophically break GCM.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decrypt(
  key: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  aad: Buffer,
): Buffer {
  if (iv.length !== IV_BYTES) throw new VaultCryptoError("Malformed IV");
  if (authTag.length !== AUTH_TAG_BYTES) throw new VaultCryptoError("Malformed auth tag");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM authentication failed: the ciphertext, IV, tag, key, or AAD does not
    // match. Deliberately one opaque message — distinguishing the causes would
    // hand an attacker an oracle.
    throw new VaultCryptoError("Decryption failed: the payload could not be authenticated");
  }
}

/**
 * Encrypts a secret.
 *
 * `credentialId` becomes the AAD, binding the ciphertext to its row. Without
 * it, someone with database write access could copy the encrypted admin
 * password into a low-value credential row and read it back through a
 * permission they legitimately hold. With it, the moved ciphertext simply
 * fails to authenticate.
 */
export function sealSecret(kek: Buffer, credentialId: string, secret: string): SealedPayload {
  assertKey(kek, "KEK");
  if (credentialId.length === 0) {
    throw new VaultCryptoError("credentialId is required as additional authenticated data");
  }

  const dek = randomBytes(KEY_BYTES);
  const aad = Buffer.from(credentialId, "utf8");

  const sealed = encrypt(dek, Buffer.from(secret, "utf8"), aad);
  // The DEK is wrapped under the same AAD, so a wrapped DEK cannot be moved
  // between rows either.
  const wrapped = encrypt(kek, dek, aad);

  // The wrapped DEK is stored as iv || authTag || ciphertext so it round-trips
  // as a single column.
  const wrappedDek = Buffer.concat([wrapped.iv, wrapped.authTag, wrapped.ciphertext]);

  dek.fill(0);

  return {
    ciphertext: toBytes(sealed.ciphertext),
    iv: toBytes(sealed.iv),
    authTag: toBytes(sealed.authTag),
    wrappedDek: toBytes(wrappedDek),
  };
}

/** Decrypts a secret. Throws if anything about the payload has been altered. */
export function openSecret(
  kek: Buffer,
  credentialId: string,
  payload: SealedPayload,
): string {
  assertKey(kek, "KEK");
  const aad = Buffer.from(credentialId, "utf8");

  if (payload.wrappedDek.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new VaultCryptoError("Malformed wrapped key");
  }

  const wrapped = Buffer.from(payload.wrappedDek);
  const wrappedIv = wrapped.subarray(0, IV_BYTES);
  const wrappedTag = wrapped.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const wrappedCipher = wrapped.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const dek = decrypt(kek, wrappedCipher, wrappedIv, wrappedTag, aad);

  try {
    return decrypt(
      dek,
      Buffer.from(payload.ciphertext),
      Buffer.from(payload.iv),
      Buffer.from(payload.authTag),
      aad,
    ).toString("utf8");
  } finally {
    // Clear the unwrapped key from memory as soon as it is no longer needed.
    dek.fill(0);
  }
}

/**
 * Re-wraps a DEK under a new KEK without touching the secret ciphertext.
 * This is what makes key rotation cheap: only the small wrapped key changes.
 */
export function rewrapDek(
  oldKek: Buffer,
  newKek: Buffer,
  credentialId: string,
  wrappedDek: Uint8Array,
): Bytes {
  assertKey(oldKek, "old KEK");
  assertKey(newKek, "new KEK");

  const aad = Buffer.from(credentialId, "utf8");
  const wrapped = Buffer.from(wrappedDek);

  const iv = wrapped.subarray(0, IV_BYTES);
  const tag = wrapped.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const cipher = wrapped.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const dek = decrypt(oldKek, cipher, iv, tag, aad);
  try {
    const rewrapped = encrypt(newKek, dek, aad);
    return toBytes(Buffer.concat([rewrapped.iv, rewrapped.authTag, rewrapped.ciphertext]));
  } finally {
    dek.fill(0);
  }
}

// --- Password generation -----------------------------------------------------

const AMBIGUOUS = new Set(["l", "I", "1", "O", "0", "o"]);

const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};

export type GeneratorOptions = {
  length?: number;
  symbols?: boolean;
  digits?: boolean;
  excludeAmbiguous?: boolean;
};

/**
 * Generates a password using rejection sampling over crypto-random bytes.
 *
 * `randomBytes(n) % alphabet.length` would bias toward the start of the
 * alphabet whenever 256 is not a multiple of the alphabet size; discarding
 * out-of-range bytes removes that bias.
 */
export function generatePassword(options: GeneratorOptions = {}): string {
  const length = Math.min(Math.max(options.length ?? 20, 8), 128);

  let alphabet = CHARSETS.lower + CHARSETS.upper;
  if (options.digits !== false) alphabet += CHARSETS.digits;
  if (options.symbols !== false) alphabet += CHARSETS.symbols;
  if (options.excludeAmbiguous) {
    alphabet = [...alphabet].filter((c) => !AMBIGUOUS.has(c)).join("");
  }

  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  const out: string[] = [];

  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= max) continue; // Discard to avoid modulo bias.
      out.push(alphabet[byte % alphabet.length] ?? "");
      if (out.length === length) break;
    }
  }

  return out.join("");
}

/** Constant-time comparison, for unlock-token verification. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
