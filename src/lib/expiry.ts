/**
 * Expiry status is COMPUTED, never stored — ADR-007.
 *
 * Storing VALID/EXPIRING_SOON/EXPIRED guarantees staleness the moment the clock
 * rolls past midnight. Everything derives from (expiryDate, today, thresholds)
 * through this one module, so SQL filters and UI badges can never disagree.
 *
 * TIMEZONE
 * --------
 * All "day" arithmetic happens in the BUSINESS timezone, never the server's.
 * Vercel functions run in UTC, developer machines run in local time, and the
 * business operates in Riyadh — using the server's local day would make an
 * Iqama expiring today in Riyadh read as "tomorrow" in production.
 *
 * Riyadh is UTC+3 year-round and observes no daylight saving, so a fixed offset
 * is exact here. If the system ever spans a DST-observing region, this constant
 * must be replaced with a real IANA lookup rather than adjusted.
 */

export const BUSINESS_TIMEZONE = "Asia/Riyadh";
const BUSINESS_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const EXPIRY_STATUSES = ["VALID", "EXPIRING_SOON", "EXPIRED"] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

/** Default warning windows, in days. Overridable per DocumentType. */
export const DEFAULT_WARNING_DAYS = [90, 60, 30, 15, 7, 1] as const;

/** The widest default window — anything beyond this is simply VALID. */
export const DEFAULT_WARNING_HORIZON = 90;

/** The Iqama dashboard buckets required by the brief §11. */
export const IQAMA_BUCKETS = [7, 15, 30, 60, 90] as const;

/**
 * The calendar day an instant falls on in the business timezone, as a day
 * number. Differences between two of these are exact calendar-day counts.
 */
function businessDayNumber(date: Date): number {
  return Math.floor((date.getTime() + BUSINESS_UTC_OFFSET_MS) / MS_PER_DAY);
}

/**
 * Whole calendar days until expiry, in the business timezone.
 * Negative = already expired. 0 = expires today.
 *
 * Calendar days (not elapsed 24h periods) is the correct unit: a document
 * expiring tomorrow morning should read "1 day", not "0" because it is 23h away.
 */
export function daysUntilExpiry(expiryDate: Date, now: Date = new Date()): number {
  return businessDayNumber(expiryDate) - businessDayNumber(now);
}

export function getExpiryStatus(
  expiryDate: Date,
  options?: { horizonDays?: number; now?: Date },
): ExpiryStatus {
  const horizon = options?.horizonDays ?? DEFAULT_WARNING_HORIZON;
  const days = daysUntilExpiry(expiryDate, options?.now);

  if (days < 0) return "EXPIRED";
  if (days <= horizon) return "EXPIRING_SOON";
  return "VALID";
}

/** An item is not expired on its expiry day — only once that day has passed. */
export function isExpired(expiryDate: Date, now: Date = new Date()): boolean {
  return daysUntilExpiry(expiryDate, now) < 0;
}

/**
 * The notification threshold an item has just crossed, or null.
 *
 * Returns the SMALLEST threshold that `days` has reached, so an item 25 days out
 * with thresholds [90,60,30,15,7,1] fires the 30-day notice once — not the 90
 * and 60 day notices retroactively. Combined with Notification.dedupeKey this
 * gives exactly one alert per threshold per user.
 */
export function crossedThreshold(
  expiryDate: Date,
  thresholds: readonly number[] = DEFAULT_WARNING_DAYS,
  now: Date = new Date(),
): number | null {
  const days = daysUntilExpiry(expiryDate, now);

  // Already expired: a single "expired" notice, keyed as threshold 0.
  if (days < 0) return 0;

  const candidates = [...thresholds].sort((a, b) => a - b);
  for (const threshold of candidates) {
    if (days <= threshold) return threshold;
  }
  return null;
}

/**
 * Inclusive upper bound for "expiring within N days" queries — the final
 * instant of that day in the business timezone.
 *
 * Use as `where: { expiryDate: { lte: expiryCutoff(30) } }`. Being inclusive
 * matters: an exclusive bound silently drops everything expiring on day N.
 */
export function expiryCutoff(withinDays: number, now: Date = new Date()): Date {
  const lastDay = businessDayNumber(now) + withinDays;
  // Start of the following day, minus 1ms, converted back to a UTC instant.
  return new Date((lastDay + 1) * MS_PER_DAY - BUSINESS_UTC_OFFSET_MS - 1);
}

/** Start of today in the business timezone, as a UTC instant. */
export function businessStartOfDay(now: Date = new Date()): Date {
  return new Date(businessDayNumber(now) * MS_PER_DAY - BUSINESS_UTC_OFFSET_MS);
}

/** Human label for badges and report columns. */
export function formatExpiryLabel(expiryDate: Date, now: Date = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);

  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? "Expired 1 day ago" : `Expired ${overdue} days ago`;
  }
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}
