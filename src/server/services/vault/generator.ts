import "server-only";
import { generatePassword, type GeneratorOptions } from "@/server/crypto/envelope";

/**
 * Password generation, exposed through the vault service.
 *
 * Actions call this rather than importing the crypto module directly, so the
 * "only src/server/services/vault may import vault crypto" rule holds without
 * exception (eslint.config.mjs, docs/SECURITY.md §5).
 */
export function generateSecret(options: GeneratorOptions): string {
  return generatePassword(options);
}
