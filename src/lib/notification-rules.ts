/**
 * Notification dedupe and threshold logic.
 *
 * Kept free of any database import so the rules that decide "does this person
 * get an alert, and have they had it already?" can be tested directly. Getting
 * this wrong means either silence or a flood, and both destroy trust in the
 * system within a week.
 */

export type ExpirySourceKey = string;

/**
 * The key that makes a notification unique.
 *
 * One alert per (source record, threshold, recipient). Re-running the scan —
 * on a retry, a redeploy, or twice in one day — must not produce duplicates,
 * so this is enforced by a UNIQUE constraint rather than by checking first.
 */
export function buildDedupeKey(input: {
  source: ExpirySourceKey;
  sourceId: string;
  threshold: number;
  userId: string;
}): string {
  return `${input.source}:${input.sourceId}:${String(input.threshold)}:${input.userId}`;
}

/** Severity escalates as the date approaches; 0 means already expired. */
export function severityForThreshold(threshold: number): "INFO" | "WARNING" | "CRITICAL" {
  if (threshold <= 0) return "CRITICAL";
  if (threshold <= 7) return "CRITICAL";
  if (threshold <= 30) return "WARNING";
  return "INFO";
}

/** Human phrasing for the alert title. */
export function describeThreshold(threshold: number): string {
  if (threshold <= 0) return "has expired";
  if (threshold === 1) return "expires tomorrow";
  return `expires in ${String(threshold)} days`;
}

/**
 * Recipients for one alert.
 *
 * A rule targets roles; the owning employee's own manager chain is deliberately
 * NOT included, because these are administrative renewals that HR and Admin
 * chase, not the employee.
 *
 * De-duplicated, because a user holding two matching roles must not be told
 * twice.
 */
export function resolveRecipients(input: {
  ruleRoleIds: readonly string[];
  usersByRole: ReadonlyMap<string, readonly string[]>;
}): string[] {
  const recipients = new Set<string>();
  for (const roleId of input.ruleRoleIds) {
    for (const userId of input.usersByRole.get(roleId) ?? []) {
      recipients.add(userId);
    }
  }
  return [...recipients];
}
