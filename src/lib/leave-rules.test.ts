import { describe, expect, it } from "vitest";
import { BLOCKING_LEAVE_STATUSES, canTransition, countLeaveDays } from "./leave-rules";

/**
 * Brief §50: "a rejected leave cannot appear as approved."
 * These tests pin the state machine that guarantees it.
 */
describe("leave state machine", () => {
  it("allows a pending request to be approved, rejected, or cancelled", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("PENDING", "REJECTED")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
  });

  // The headline rule: once rejected, a request is terminal. There is no path
  // by which it can later read as approved.
  it("never allows a rejected request to become approved", () => {
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
    expect(canTransition("REJECTED", "PENDING")).toBe(false);
    expect(canTransition("REJECTED", "CANCELLED")).toBe(false);
  });

  // Silently flipping an approval to "rejected" would revoke leave someone may
  // already have taken. Reversal is a cancellation, and is recorded as one.
  it("does not allow an approved request to be rejected", () => {
    expect(canTransition("APPROVED", "REJECTED")).toBe(false);
    expect(canTransition("APPROVED", "CANCELLED")).toBe(true);
  });

  it("treats cancelled as terminal", () => {
    for (const target of ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const) {
      expect(canTransition("CANCELLED", target)).toBe(false);
    }
  });

  it("does not allow anything to return to pending", () => {
    for (const from of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
      expect(canTransition(from, "PENDING")).toBe(false);
    }
  });

  it("counts only pending and approved as occupying the calendar", () => {
    expect(BLOCKING_LEAVE_STATUSES).toEqual(["PENDING", "APPROVED"]);
    // A rejected or cancelled request must not block a resubmission.
    expect(BLOCKING_LEAVE_STATUSES).not.toContain("REJECTED");
    expect(BLOCKING_LEAVE_STATUSES).not.toContain("CANCELLED");
  });
});

describe("countLeaveDays", () => {
  // A one-day leave is 1 day, not 0 — an exclusive count would under-report
  // every single-day absence.
  it("counts inclusively", () => {
    expect(countLeaveDays(new Date("2026-05-01"), new Date("2026-05-01"))).toBe(1);
    expect(countLeaveDays(new Date("2026-05-01"), new Date("2026-05-05"))).toBe(5);
  });

  it("ignores the time of day", () => {
    expect(
      countLeaveDays(new Date("2026-05-01T23:00:00Z"), new Date("2026-05-02T01:00:00Z")),
    ).toBe(2);
  });

  it("counts across month and year boundaries", () => {
    expect(countLeaveDays(new Date("2026-05-30"), new Date("2026-06-02"))).toBe(4);
    expect(countLeaveDays(new Date("2026-12-30"), new Date("2027-01-02"))).toBe(4);
  });
});
