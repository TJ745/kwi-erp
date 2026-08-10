import { describe, expect, it } from "vitest";
import {
  businessStartOfDay,
  crossedThreshold,
  daysUntilExpiry,
  expiryCutoff,
  formatExpiryLabel,
  getExpiryStatus,
  isExpired,
} from "./expiry";

/**
 * All fixtures are UTC instants, interpreted in the business timezone
 * (Asia/Riyadh, UTC+3). These tests must pass regardless of the machine's own
 * timezone — that is precisely the bug they exist to prevent.
 *
 * NOW = 2026-08-10T09:00Z = 12:00 on 10 August in Riyadh.
 */
const NOW = new Date("2026-08-10T09:00:00Z");
const at = (iso: string) => new Date(iso);

describe("daysUntilExpiry", () => {
  it("counts calendar days, not elapsed 24h periods", () => {
    // 2026-08-11 09:00 Riyadh — 21h away, but the next calendar day.
    expect(daysUntilExpiry(at("2026-08-11T06:00:00Z"), NOW)).toBe(1);
  });

  it("returns 0 anywhere within the expiry day, Riyadh time", () => {
    // 00:30 and 23:00 on 10 August in Riyadh.
    expect(daysUntilExpiry(at("2026-08-09T21:30:00Z"), NOW)).toBe(0);
    expect(daysUntilExpiry(at("2026-08-10T20:00:00Z"), NOW)).toBe(0);
  });

  it("returns negative values once expired", () => {
    expect(daysUntilExpiry(at("2026-08-07T09:00:00Z"), NOW)).toBe(-3);
  });

  // The regression this module exists to prevent: 22:00 UTC on 9 August is
  // already 01:00 on 10 August in Riyadh, so it is TODAY, not yesterday.
  it("resolves instants near midnight using Riyadh, not UTC", () => {
    expect(daysUntilExpiry(at("2026-08-09T22:00:00Z"), NOW)).toBe(0);
    // And 21:00 UTC on 10 August is already 11 August in Riyadh.
    expect(daysUntilExpiry(at("2026-08-10T21:00:00Z"), NOW)).toBe(1);
  });
});

describe("getExpiryStatus", () => {
  it("is EXPIRED only after the expiry day has passed", () => {
    expect(getExpiryStatus(at("2026-08-10T09:00:00Z"), { now: NOW })).toBe("EXPIRING_SOON");
    expect(getExpiryStatus(at("2026-08-09T09:00:00Z"), { now: NOW })).toBe("EXPIRED");
  });

  it("is EXPIRING_SOON at exactly the horizon boundary", () => {
    // 90 days out, default horizon 90 -> still a warning.
    expect(getExpiryStatus(at("2026-11-08T09:00:00Z"), { now: NOW })).toBe("EXPIRING_SOON");
  });

  it("is VALID one day beyond the horizon", () => {
    expect(getExpiryStatus(at("2026-11-09T09:00:00Z"), { now: NOW })).toBe("VALID");
  });

  it("respects a custom horizon", () => {
    const in45Days = at("2026-09-24T09:00:00Z");
    expect(getExpiryStatus(in45Days, { now: NOW, horizonDays: 30 })).toBe("VALID");
    expect(getExpiryStatus(in45Days, { now: NOW, horizonDays: 60 })).toBe("EXPIRING_SOON");
  });
});

describe("isExpired", () => {
  it("does not treat the expiry day itself as expired", () => {
    expect(isExpired(at("2026-08-10T09:00:00Z"), NOW)).toBe(false);
    // 23:00 Riyadh on the expiry day — still valid.
    expect(isExpired(at("2026-08-10T20:00:00Z"), NOW)).toBe(false);
    // Any time on 9 August Riyadh — expired.
    expect(isExpired(at("2026-08-09T18:00:00Z"), NOW)).toBe(true);
  });
});

describe("crossedThreshold", () => {
  const thresholds = [90, 60, 30, 15, 7, 1];

  it("returns the smallest threshold reached, so only one notice fires", () => {
    // 25 days out: passes 90/60/30 but the 30 notice is the right one.
    expect(crossedThreshold(at("2026-09-04T09:00:00Z"), thresholds, NOW)).toBe(30);
  });

  it("returns the exact threshold when landing on it", () => {
    expect(crossedThreshold(at("2026-08-17T09:00:00Z"), thresholds, NOW)).toBe(7);
  });

  it("returns null when still beyond every threshold", () => {
    expect(crossedThreshold(at("2027-08-10T09:00:00Z"), thresholds, NOW)).toBeNull();
  });

  it("returns 0 for already-expired items", () => {
    expect(crossedThreshold(at("2026-08-01T09:00:00Z"), thresholds, NOW)).toBe(0);
  });

  it("tightens as the date approaches, giving one notice per threshold", () => {
    const expiry = at("2026-11-08T09:00:00Z"); // 90 days out
    expect(crossedThreshold(expiry, thresholds, NOW)).toBe(90);
    expect(crossedThreshold(expiry, thresholds, at("2026-09-09T09:00:00Z"))).toBe(60);
    expect(crossedThreshold(expiry, thresholds, at("2026-11-07T09:00:00Z"))).toBe(1);
    expect(crossedThreshold(expiry, thresholds, at("2026-11-08T09:00:00Z"))).toBe(1);
  });
});

describe("expiryCutoff", () => {
  it("is inclusive of the whole final day", () => {
    const cutoff = expiryCutoff(30, NOW);

    // 23:59:59.999 Riyadh on 9 September == 20:59:59.999Z.
    expect(cutoff.toISOString()).toBe("2026-09-09T20:59:59.999Z");

    // An item expiring at 22:00 Riyadh on day 30 must be included.
    const lateOnFinalDay = at("2026-09-09T19:00:00Z");
    expect(lateOnFinalDay.getTime()).toBeLessThanOrEqual(cutoff.getTime());
    expect(daysUntilExpiry(lateOnFinalDay, NOW)).toBe(30);

    // The first instant of day 31 must be excluded.
    const startOfDay31 = at("2026-09-09T21:00:00Z");
    expect(startOfDay31.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  it("handles a zero-day window as 'end of today'", () => {
    const cutoff = expiryCutoff(0, NOW);
    expect(cutoff.toISOString()).toBe("2026-08-10T20:59:59.999Z");
  });
});

describe("businessStartOfDay", () => {
  it("returns midnight Riyadh as a UTC instant", () => {
    expect(businessStartOfDay(NOW).toISOString()).toBe("2026-08-09T21:00:00.000Z");
  });
});

describe("formatExpiryLabel", () => {
  it("uses singular and plural forms correctly", () => {
    expect(formatExpiryLabel(at("2026-08-10T09:00:00Z"), NOW)).toBe("Expires today");
    expect(formatExpiryLabel(at("2026-08-11T09:00:00Z"), NOW)).toBe("Expires tomorrow");
    expect(formatExpiryLabel(at("2026-08-20T09:00:00Z"), NOW)).toBe("Expires in 10 days");
    expect(formatExpiryLabel(at("2026-08-09T09:00:00Z"), NOW)).toBe("Expired 1 day ago");
    expect(formatExpiryLabel(at("2026-08-05T09:00:00Z"), NOW)).toBe("Expired 5 days ago");
  });
});
