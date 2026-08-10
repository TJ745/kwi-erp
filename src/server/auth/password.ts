import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id parameters — the OWASP-recommended 19 MiB / t=2 profile.
 * See docs/SECURITY.md §2.
 *
 * Parameters are embedded in the PHC string that `hash` returns, so they can be
 * raised later and existing hashes upgraded transparently on next login.
 */
export const ARGON2_OPTIONS = {
  /** 19 MiB, expressed in KiB. */
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password. Returns false rather than throwing on a malformed hash,
 * so a corrupt record cannot be distinguished from a wrong password.
 */
export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
