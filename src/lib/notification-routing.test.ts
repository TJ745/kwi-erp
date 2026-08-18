import { describe, expect, it } from "vitest";
import { decideEmail, type RoutingInput } from "./notification-routing";

/**
 * The seeded rules said IN_APP only for every kind, which meant expiry
 * reminders — the reason the reminder engine exists — would never have emailed
 * however the provider was configured. That was found by running the thing and
 * reading the rows back; these tests make the decision checkable directly.
 */

const DEFAULTS = new Set(["APPROVAL_REQUIRED", "TICKET_ASSIGNED"]);

const input = (over: Partial<RoutingInput> = {}): RoutingInput => ({
  kind: "APPROVAL_REQUIRED",
  ruleChannels: null,
  defaultEmailKinds: DEFAULTS,
  recipient: { status: "ACTIVE", email: "someone@example.com" },
  isConfigured: true,
  ...over,
});

describe("decideEmail — configuration", () => {
  it("skips everything when no provider is configured", () => {
    expect(decideEmail(input({ isConfigured: false }))).toEqual({
      email: false,
      reason: "NOT_CONFIGURED",
    });
  });

  it("checks configuration before anything else, so rows settle rather than pend", () => {
    const decision = decideEmail(
      input({ isConfigured: false, recipient: null, ruleChannels: ["EMAIL"] }),
    );
    expect(decision).toEqual({ email: false, reason: "NOT_CONFIGURED" });
  });
});

describe("decideEmail — the rule is authoritative", () => {
  it("emails when the rule lists EMAIL", () => {
    expect(decideEmail(input({ kind: "EXPIRY", ruleChannels: ["IN_APP", "EMAIL"] }))).toEqual({
      email: true,
    });
  });

  it("does not email when the rule lists only IN_APP", () => {
    // The exact case that made expiry reminders silent.
    expect(decideEmail(input({ kind: "EXPIRY", ruleChannels: ["IN_APP"] }))).toEqual({
      email: false,
      reason: "KIND_IS_IN_APP_ONLY",
    });
  });

  it("lets a rule override a kind that is in the defaults", () => {
    // APPROVAL_REQUIRED is a default-email kind; an explicit rule still wins.
    expect(
      decideEmail(input({ kind: "APPROVAL_REQUIRED", ruleChannels: ["IN_APP"] })),
    ).toEqual({ email: false, reason: "KIND_IS_IN_APP_ONLY" });
  });

  it("lets a rule enable a kind that is not in the defaults", () => {
    expect(decideEmail(input({ kind: "TASK_DUE", ruleChannels: ["EMAIL"] }))).toEqual({
      email: true,
    });
  });

  it("treats an empty channel list as in-app only, not as unset", () => {
    // A rule that exists with no channels is a deliberate "send nothing".
    expect(decideEmail(input({ kind: "EXPIRY", ruleChannels: [] }))).toEqual({
      email: false,
      reason: "KIND_IS_IN_APP_ONLY",
    });
  });
});

describe("decideEmail — defaults apply only without a rule", () => {
  it("emails a default kind when no rule governs it", () => {
    expect(decideEmail(input({ kind: "APPROVAL_REQUIRED", ruleChannels: null }))).toEqual({
      email: true,
    });
    expect(decideEmail(input({ kind: "TICKET_ASSIGNED", ruleChannels: null }))).toEqual({
      email: true,
    });
  });

  it("does not email a non-default kind when no rule governs it", () => {
    expect(decideEmail(input({ kind: "MENTION", ruleChannels: null }))).toEqual({
      email: false,
      reason: "KIND_IS_IN_APP_ONLY",
    });
    expect(decideEmail(input({ kind: "SYSTEM", ruleChannels: null }))).toEqual({
      email: false,
      reason: "KIND_IS_IN_APP_ONLY",
    });
  });
});

describe("decideEmail — the recipient", () => {
  it("skips a recipient who no longer exists", () => {
    expect(decideEmail(input({ recipient: null }))).toEqual({
      email: false,
      reason: "NO_RECIPIENT",
    });
  });

  it("skips a deactivated recipient", () => {
    // Their access is gone; telling them about work they cannot open is worse
    // than silence.
    for (const status of ["DISABLED", "SUSPENDED"]) {
      expect(
        decideEmail(input({ recipient: { status, email: "x@example.com" } })),
      ).toEqual({ email: false, reason: "RECIPIENT_INACTIVE" });
    }
  });

  it("skips a recipient with no address", () => {
    expect(decideEmail(input({ recipient: { status: "ACTIVE", email: null } }))).toEqual({
      email: false,
      reason: "RECIPIENT_HAS_NO_ADDRESS",
    });
    expect(decideEmail(input({ recipient: { status: "ACTIVE", email: "" } }))).toEqual({
      email: false,
      reason: "RECIPIENT_HAS_NO_ADDRESS",
    });
  });

  it("checks the kind before the recipient, so an in-app kind never reports a recipient problem", () => {
    // Reason ordering matters: it is what an administrator reads to work out
    // why somebody was not told.
    expect(
      decideEmail(input({ kind: "MENTION", ruleChannels: null, recipient: null })),
    ).toEqual({ email: false, reason: "KIND_IS_IN_APP_ONLY" });
  });
});

describe("decideEmail — the happy path", () => {
  it("emails an active recipient with an address for an enabled kind", () => {
    expect(decideEmail(input())).toEqual({ email: true });
  });
});
