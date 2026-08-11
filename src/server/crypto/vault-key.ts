import "server-only";
import { getEnv, getVaultKek } from "@/lib/env";
import { VaultCryptoError } from "./envelope";

/**
 * KEK resolution — docs/SECURITY.md §5.3.
 *
 * The key lives only in the platform secret store. It is never written to the
 * database, never logged, and never exposed under NEXT_PUBLIC_.
 */

/** The version new encryptions are written under. */
export function activeKeyVersion(): number {
  return getEnv().VAULT_KEK_ACTIVE_VERSION;
}

/**
 * Resolves a specific key version, for decrypting rows written before a
 * rotation. A missing version is a configuration error, not a data error —
 * failing loudly is correct, because the alternative is silently unreadable
 * credentials.
 */
export function keyForVersion(version: number): Buffer {
  try {
    return getVaultKek(version);
  } catch {
    throw new VaultCryptoError(
      `Vault key version ${String(version)} is not configured. ` +
        "Credentials written under it cannot be read until it is restored.",
    );
  }
}

export function activeKey(): Buffer {
  return keyForVersion(activeKeyVersion());
}
