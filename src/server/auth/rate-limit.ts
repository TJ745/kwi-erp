import "server-only";
import { prisma } from "@/server/db/client";
import { RateLimitedError } from "@/lib/result";

/**
 * Database-backed rate limiting — docs/SECURITY.md §4.
 *
 * In-memory counters are useless on serverless (every cold start resets them,
 * and instances do not share state), and Redis would be extra infrastructure
 * for one feature. A small table is the honest trade-off.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 15 * 60 },
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },
  /**
   * Changing your own password requires the current one, which makes it a
   * brute-force target for anyone holding a stolen session cookie — and a
   * successful change revokes the real user's other sessions, completing the
   * takeover. Matches the login window rather than the tighter reset one, so a
   * user who mistypes their current password is not locked out for an hour.
   */
  passwordChange: { limit: 5, windowSeconds: 15 * 60 },
  vaultUnlock: { limit: 5, windowSeconds: 15 * 60 },
  vaultReveal: { limit: 10, windowSeconds: 5 * 60 },
  fileDownload: { limit: 120, windowSeconds: 60 },
  reportExport: { limit: 10, windowSeconds: 60 * 60 },
  /**
   * Tighter than a report export. The audit log is the record of everything
   * anyone has done, so a bulk copy of it is the single most useful artefact
   * an attacker with a session could take.
   */
  auditExport: { limit: 5, windowSeconds: 60 * 60 },
  /**
   * Bulk employee import. Each preview re-parses and re-validates the whole
   * file, and a commit writes hundreds of rows in one transaction; neither is
   * something a person does more than a few times an hour on purpose.
   */
  employeeImport: { limit: 30, windowSeconds: 60 * 60 },
  globalSearch: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Consumes one unit against `name:identifier`.
 *
 * Throws RateLimitedError when the window is exhausted. The window is fixed
 * rather than sliding — simpler, and adequate for abuse prevention.
 */
export async function consumeRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<void> {
  const rule = RATE_LIMITS[name];
  const key = `${name}:${identifier}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + rule.windowSeconds * 1000);

  // Atomic: one statement decides both reset-vs-increment and the new count,
  // so concurrent requests cannot race past the limit.
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."expiresAt" < ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" < ${now} THEN ${expiresAt}
        ELSE "RateLimitBucket"."expiresAt"
      END
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 1;
  if (count > rule.limit) throw new RateLimitedError();
}

/** Clears a bucket after a legitimate success (e.g. a correct login). */
export async function resetRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key: `${name}:${identifier}` } });
}

/** Housekeeping for the nightly cron; expired buckets are otherwise inert. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
