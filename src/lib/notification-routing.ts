/**
 * Who gets an email, and why.
 *
 * Pulled out of the dispatcher as a pure function so it can be tested
 * exhaustively. The dispatcher does the I/O — read pending rows, call the
 * provider, record the outcome — and this decides. Previously the decision was
 * tangled with the sending, which meant the only way to check "does an EXPIRY
 * reminder actually email?" was to run a cron against a database and read the
 * rows back.
 *
 * The rule that matters: a `NotificationRule` for the kind is authoritative,
 * because its `channels` field is the setting an administrator can see and
 * change. Defaults apply only where no rule exists.
 */

export type EmailDecision =
  | { email: true }
  | { email: false; reason: EmailSkipReason };

export type EmailSkipReason =
  | "NOT_CONFIGURED"
  | "KIND_IS_IN_APP_ONLY"
  | "NO_RECIPIENT"
  | "RECIPIENT_INACTIVE"
  | "RECIPIENT_HAS_NO_ADDRESS";

export type RoutingInput = {
  kind: string;
  /** The rule's channels, or null when no rule governs this kind. */
  ruleChannels: readonly string[] | null;
  /** Kinds emailed when no rule governs them. */
  defaultEmailKinds: ReadonlySet<string>;
  recipient: { status: string; email: string | null } | null;
  isConfigured: boolean;
};

export function decideEmail(input: RoutingInput): EmailDecision {
  // Checked first: with no transport there is nothing to decide, and the row
  // should settle rather than sit pending forever.
  if (!input.isConfigured) return { email: false, reason: "NOT_CONFIGURED" };

  const wantsEmail = input.ruleChannels
    ? input.ruleChannels.includes("EMAIL")
    : input.defaultEmailKinds.has(input.kind);

  if (!wantsEmail) return { email: false, reason: "KIND_IS_IN_APP_ONLY" };

  if (!input.recipient) return { email: false, reason: "NO_RECIPIENT" };

  // A deactivated recipient is a decision, not an oversight: their access is
  // gone, so telling them about work they cannot open is worse than silence.
  if (input.recipient.status !== "ACTIVE") {
    return { email: false, reason: "RECIPIENT_INACTIVE" };
  }

  if (!input.recipient.email) return { email: false, reason: "RECIPIENT_HAS_NO_ADDRESS" };

  return { email: true };
}
