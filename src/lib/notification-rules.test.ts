import { describe, expect, it } from "vitest";
import {
  buildDedupeKey,
  describeThreshold,
  resolveRecipients,
  severityForThreshold,
} from "./notification-rules";

/**
 * Getting dedupe wrong means either silence or a flood, and both destroy trust
 * in the reminder system within a week. These tests pin the behaviour.
 */
describe("buildDedupeKey", () => {
  const base = { source: "IQAMA", sourceId: "abc", threshold: 30, userId: "u1" };

  it("is stable for the same alert", () => {
    expect(buildDedupeKey(base)).toBe(buildDedupeKey({ ...base }));
  });

  // The four things that must make an alert distinct.
  it("differs per source record", () => {
    expect(buildDedupeKey(base)).not.toBe(buildDedupeKey({ ...base, sourceId: "def" }));
  });

  it("differs per threshold, so 30-day and 7-day both fire", () => {
    expect(buildDedupeKey(base)).not.toBe(buildDedupeKey({ ...base, threshold: 7 }));
  });

  it("differs per recipient, so two people each get told", () => {
    expect(buildDedupeKey(base)).not.toBe(buildDedupeKey({ ...base, userId: "u2" }));
  });

  it("differs per source type", () => {
    expect(buildDedupeKey(base)).not.toBe(buildDedupeKey({ ...base, source: "PASSPORT" }));
  });

  // Two different records must never collide just because their ids and
  // thresholds concatenate to the same string.
  it("does not collide across plausible id shapes", () => {
    const a = buildDedupeKey({ source: "IQAMA", sourceId: "a", threshold: 1, userId: "b" });
    const b = buildDedupeKey({ source: "IQAMA", sourceId: "a:1", threshold: 1, userId: "b" });
    expect(a).not.toBe(b);
  });
});

describe("severityForThreshold", () => {
  it("escalates as the date approaches", () => {
    expect(severityForThreshold(90)).toBe("INFO");
    expect(severityForThreshold(60)).toBe("INFO");
    expect(severityForThreshold(30)).toBe("WARNING");
    expect(severityForThreshold(15)).toBe("WARNING");
    expect(severityForThreshold(7)).toBe("CRITICAL");
    expect(severityForThreshold(1)).toBe("CRITICAL");
  });

  it("treats already-expired as critical", () => {
    expect(severityForThreshold(0)).toBe("CRITICAL");
    expect(severityForThreshold(-5)).toBe("CRITICAL");
  });
});

describe("describeThreshold", () => {
  it("reads naturally at each boundary", () => {
    expect(describeThreshold(0)).toBe("has expired");
    expect(describeThreshold(1)).toBe("expires tomorrow");
    expect(describeThreshold(30)).toBe("expires in 30 days");
  });
});

describe("resolveRecipients", () => {
  const usersByRole = new Map<string, string[]>([
    ["hr", ["u1", "u2"]],
    ["admin", ["u2", "u3"]],
    ["empty", []],
  ]);

  it("collects users across every targeted role", () => {
    const result = resolveRecipients({ ruleRoleIds: ["hr", "admin"], usersByRole });
    expect([...result].sort()).toEqual(["u1", "u2", "u3"]);
  });

  // u2 holds both roles and must not be notified twice.
  it("de-duplicates a user in two roles", () => {
    const result = resolveRecipients({ ruleRoleIds: ["hr", "admin"], usersByRole });
    expect(result.filter((id) => id === "u2")).toHaveLength(1);
  });

  it("returns nothing when no role matches", () => {
    expect(resolveRecipients({ ruleRoleIds: ["nobody"], usersByRole })).toEqual([]);
    expect(resolveRecipients({ ruleRoleIds: [], usersByRole })).toEqual([]);
    expect(resolveRecipients({ ruleRoleIds: ["empty"], usersByRole })).toEqual([]);
  });
});
