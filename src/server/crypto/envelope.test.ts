import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AUTH_TAG_BYTES,
  generatePassword,
  IV_BYTES,
  KEY_BYTES,
  openSecret,
  rewrapDek,
  safeEquals,
  sealSecret,
  VaultCryptoError,
} from "./envelope";

const kek = () => randomBytes(KEY_BYTES);
const ID = "cred_abc123";
const SECRET = "correct-horse-battery-staple";

/** Sealed payloads are Uint8Array (Prisma's Bytes shape), not Buffer. */
const buf = (bytes: Uint8Array) => Buffer.from(bytes);
const sameBytes = (a: Uint8Array, b: Uint8Array) => buf(a).equals(buf(b));

describe("sealSecret / openSecret", () => {
  it("round-trips a secret", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);
    expect(openSecret(key, ID, sealed)).toBe(SECRET);
  });

  it("round-trips unicode and long secrets", () => {
    const key = kek();
    const secrets = ["كلمة السر", "🔐🔑", "x".repeat(4096), ""];
    for (const secret of secrets) {
      const sealed = sealSecret(key, ID, secret);
      expect(openSecret(key, ID, sealed)).toBe(secret);
    }
  });

  it("never stores the plaintext in the ciphertext", () => {
    const sealed = sealSecret(kek(), ID, SECRET);
    expect(buf(sealed.ciphertext).toString("utf8")).not.toContain(SECRET);
    expect(buf(sealed.ciphertext).toString("hex")).not.toContain(
      Buffer.from(SECRET).toString("hex"),
    );
  });

  // A fresh IV and DEK per call means identical secrets produce different
  // ciphertexts. Equal ciphertexts would leak that two accounts share a password.
  it("produces different ciphertexts for the same secret", () => {
    const key = kek();
    const a = sealSecret(key, ID, SECRET);
    const b = sealSecret(key, ID, SECRET);

    expect(sameBytes(a.ciphertext, b.ciphertext)).toBe(false);
    expect(sameBytes(a.iv, b.iv)).toBe(false);
    expect(sameBytes(a.wrappedDek, b.wrappedDek)).toBe(false);
  });

  it("uses the documented IV and tag sizes", () => {
    const sealed = sealSecret(kek(), ID, SECRET);
    expect(sealed.iv.length).toBe(IV_BYTES);
    expect(sealed.authTag.length).toBe(AUTH_TAG_BYTES);
  });
});

describe("AAD binding — ciphertext cannot be moved between rows", () => {
  /**
   * The threat: someone with database write access copies the encrypted
   * SUPER_ADMIN credential into a row they are permitted to reveal. Binding the
   * AAD to the credential id makes that ciphertext fail to authenticate.
   */
  it("refuses to decrypt under a different credential id", () => {
    const key = kek();
    const sealed = sealSecret(key, "cred_high_value", SECRET);

    expect(() => openSecret(key, "cred_low_value", sealed)).toThrow(VaultCryptoError);
  });

  it("refuses an empty credential id when sealing", () => {
    expect(() => sealSecret(kek(), "", SECRET)).toThrow(VaultCryptoError);
  });
});

describe("tamper detection", () => {
  it("rejects a modified ciphertext", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() => openSecret(key, ID, { ...sealed, ciphertext: tampered })).toThrow(
      VaultCryptoError,
    );
  });

  it("rejects a modified auth tag", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);
    const tampered = Buffer.from(sealed.authTag);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() => openSecret(key, ID, { ...sealed, authTag: tampered })).toThrow(
      VaultCryptoError,
    );
  });

  it("rejects a modified IV", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);
    const tampered = Buffer.from(sealed.iv);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() => openSecret(key, ID, { ...sealed, iv: tampered })).toThrow(VaultCryptoError);
  });

  it("rejects a modified wrapped key", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);
    const tampered = Buffer.from(sealed.wrappedDek);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() => openSecret(key, ID, { ...sealed, wrappedDek: tampered })).toThrow(
      VaultCryptoError,
    );
  });

  it("rejects a wrapped key from another credential", () => {
    const key = kek();
    const mine = sealSecret(key, ID, SECRET);
    const theirs = sealSecret(key, "cred_other", "another-secret");

    expect(() => openSecret(key, ID, { ...mine, wrappedDek: theirs.wrappedDek })).toThrow(
      VaultCryptoError,
    );
  });

  it("rejects malformed payload sizes rather than crashing", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);

    expect(() => openSecret(key, ID, { ...sealed, wrappedDek: Buffer.alloc(4) })).toThrow(
      VaultCryptoError,
    );
    expect(() => openSecret(key, ID, { ...sealed, iv: Buffer.alloc(4) })).toThrow(
      VaultCryptoError,
    );
    expect(() => openSecret(key, ID, { ...sealed, authTag: Buffer.alloc(4) })).toThrow(
      VaultCryptoError,
    );
  });
});

describe("key handling", () => {
  it("refuses a KEK of the wrong length", () => {
    for (const size of [16, 24, 31, 33, 64]) {
      expect(() => sealSecret(randomBytes(size), ID, SECRET)).toThrow(VaultCryptoError);
    }
  });

  // A database dump without the KEK must be useless.
  it("cannot decrypt with a different KEK", () => {
    const sealed = sealSecret(kek(), ID, SECRET);
    expect(() => openSecret(kek(), ID, sealed)).toThrow(VaultCryptoError);
  });

  it("gives one opaque failure message, not a distinguishing oracle", () => {
    const key = kek();
    const sealed = sealSecret(key, ID, SECRET);

    const wrongKey = (() => {
      try {
        openSecret(kek(), ID, sealed);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();

    const wrongAad = (() => {
      try {
        openSecret(key, "other", sealed);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();

    expect(wrongKey).toBe(wrongAad);
  });
});

describe("rewrapDek — key rotation", () => {
  it("re-wraps under a new KEK, leaving the secret readable", () => {
    const oldKek = kek();
    const newKek = kek();
    const sealed = sealSecret(oldKek, ID, SECRET);

    const rewrapped = rewrapDek(oldKek, newKek, ID, sealed.wrappedDek);

    // Readable under the new key…
    expect(openSecret(newKek, ID, { ...sealed, wrappedDek: rewrapped })).toBe(SECRET);
    // …and no longer under the old one.
    expect(() => openSecret(oldKek, ID, { ...sealed, wrappedDek: rewrapped })).toThrow();
  });

  it("leaves the secret ciphertext untouched — only the small key changes", () => {
    const oldKek = kek();
    const newKek = kek();
    const sealed = sealSecret(oldKek, ID, SECRET);
    const before = Buffer.from(sealed.ciphertext);

    rewrapDek(oldKek, newKek, ID, sealed.wrappedDek);

    expect(sameBytes(sealed.ciphertext, before)).toBe(true);
  });

  it("refuses to re-wrap with the wrong current KEK", () => {
    const sealed = sealSecret(kek(), ID, SECRET);
    expect(() => rewrapDek(kek(), kek(), ID, sealed.wrappedDek)).toThrow(VaultCryptoError);
  });
});

describe("generatePassword", () => {
  it("honours the requested length within bounds", () => {
    expect(generatePassword({ length: 20 })).toHaveLength(20);
    expect(generatePassword({ length: 4 })).toHaveLength(8); // clamped up
    expect(generatePassword({ length: 999 })).toHaveLength(128); // clamped down
  });

  it("excludes ambiguous characters when asked", () => {
    for (let i = 0; i < 20; i += 1) {
      const password = generatePassword({ length: 64, excludeAmbiguous: true });
      expect(password).not.toMatch(/[lI1O0o]/);
    }
  });

  it("omits symbols and digits when disabled", () => {
    const password = generatePassword({ length: 64, symbols: false, digits: false });
    expect(password).toMatch(/^[a-zA-Z]+$/);
  });

  it("does not repeat across calls", () => {
    const generated = new Set(Array.from({ length: 200 }, () => generatePassword()));
    expect(generated.size).toBe(200);
  });

  // Rejection sampling should leave no character grossly over-represented.
  it("distributes characters without obvious modulo bias", () => {
    const counts = new Map<string, number>();
    const sample = generatePassword({ length: 128, symbols: false, digits: false });
    for (let i = 0; i < 200; i += 1) {
      for (const c of generatePassword({ length: 128, symbols: false, digits: false })) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    void sample;

    const values = [...counts.values()];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    // With 52 letters and ~25 600 samples, a biased implementation shows a
    // roughly 2x skew; a fair one stays well inside 1.5x.
    expect(max).toBeLessThan(mean * 1.5);
  });
});

describe("safeEquals", () => {
  it("matches identical strings and rejects others", () => {
    expect(safeEquals("token", "token")).toBe(true);
    expect(safeEquals("token", "tokeN")).toBe(false);
    expect(safeEquals("token", "tok")).toBe(false);
    expect(safeEquals("", "")).toBe(true);
  });
});
