/**
 * Leave state machine and day counting.
 *
 * Deliberately free of any database or server import so it can be unit-tested
 * directly — this is the logic behind brief §50, "a rejected leave cannot
 * appear as approved", and it deserves tests that do not need a connection.
 */

export type LeaveStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/**
 * Allowed transitions. Anything absent is refused — including
 * APPROVED → REJECTED, which would silently revoke leave someone may already
 * have taken. Reversing an approval is a cancellation, and is recorded as one.
 */
const TRANSITIONS: Record<LeaveStatusValue, LeaveStatusValue[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: LeaveStatusValue, to: LeaveStatusValue): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses that still occupy the calendar, for overlap detection. */
export const BLOCKING_LEAVE_STATUSES: LeaveStatusValue[] = ["PENDING", "APPROVED"];

/**
 * Inclusive whole-day count: a one-day leave is 1, not 0.
 * An exclusive count would under-report every single-day absence.
 */
export function countLeaveDays(start: Date, end: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(start.getTime() / MS_PER_DAY);
  const endDay = Math.floor(end.getTime() / MS_PER_DAY);
  return endDay - startDay + 1;
}
