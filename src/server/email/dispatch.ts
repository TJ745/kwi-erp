import "server-only";
import type { NotificationKind } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { logger } from "@/server/logger";
import { isEmailConfigured, sendEmail } from "./provider";
import { renderNotificationEmail } from "./templates";
import { decideEmail } from "@/lib/notification-routing";

/**
 * Turns notifications into email.
 *
 * Two things decide whether a notification is emailed:
 *
 *   1. A `NotificationRule` for that kind, if one exists — the existing
 *      `channels` field is the authority, so this uses the model that was
 *      already there rather than inventing a parallel setting.
 *   2. Failing that, the defaults below: the kinds worth interrupting somebody
 *      for. Everything else stays in-app.
 *
 * Delivery is recorded on the notification itself, so "did they get told?" is
 * answerable per row, and a failure is retried by the nightly sweep rather than
 * lost.
 */

/**
 * Emailed when no rule says otherwise.
 *
 * These are the kinds with no seeded rule. APPROVAL_REQUIRED is the one that
 * justifies the whole feature: an approval queue nobody is told about only
 * moves when somebody happens to look.
 *
 * EXPIRY is deliberately absent — it has rules, and a rule always wins, so
 * listing it here would describe behaviour that cannot happen. Expiry emails
 * are switched on by its rules (see prisma/seed.ts).
 */
const DEFAULT_EMAIL_KINDS: ReadonlySet<NotificationKind> = new Set(["APPROVAL_REQUIRED"]);

/** Gives up after this many attempts; the row keeps FAILED and its reason. */
const MAX_ATTEMPTS = 3;

export type DispatchResult = {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Sends any notification still waiting for email.
 *
 * Safe to call from a request path (fire-and-forget) and from the cron: it
 * claims rows by incrementing `emailAttempts`, so two overlapping runs cannot
 * both send the same one.
 */
export async function dispatchPendingEmails(
  options: { limit?: number } = {},
): Promise<DispatchResult> {
  const result: DispatchResult = { considered: 0, sent: 0, skipped: 0, failed: 0 };

  const pending = await prisma.notification.findMany({
    where: { emailStatus: { in: ["PENDING", "FAILED"] }, emailAttempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 100,
    select: {
      id: true,
      userId: true,
      kind: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
    },
  });

  result.considered = pending.length;
  if (pending.length === 0) return result;

  // Configuration is checked once, not per row: with no transport every row
  // resolves to SKIPPED and there is nothing to retry later.
  if (!isEmailConfigured()) {
    const { count } = await prisma.notification.updateMany({
      where: { id: { in: pending.map((n) => n.id) } },
      data: { emailStatus: "SKIPPED", emailError: null },
    });
    result.skipped = count;
    return result;
  }

  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true },
    select: { kind: true, channels: true },
  });
  const channelsByKind = new Map(rules.map((r) => [r.kind, r.channels]));

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(pending.map((n) => n.userId))] } },
    select: { id: true, name: true, email: true, status: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const appUrl = getEnv().APP_URL;

  for (const notification of pending) {
    const user = userById.get(notification.userId);

    // The decision is a pure function, tested in lib/notification-routing.
    const decision = decideEmail({
      kind: notification.kind,
      ruleChannels: channelsByKind.get(notification.kind) ?? null,
      defaultEmailKinds: DEFAULT_EMAIL_KINDS,
      recipient: user ? { status: user.status, email: user.email } : null,
      isConfigured: true,
    });

    if (!decision.email) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "SKIPPED", emailError: null },
      });
      result.skipped += 1;
      continue;
    }

    // `decideEmail` already guarantees an active recipient with an address —
    // it returns NO_RECIPIENT or RECIPIENT_HAS_NO_ADDRESS otherwise — but the
    // compiler cannot see through the returned union, so the narrowing is
    // restated rather than asserted away with a cast.
    if (!user?.email) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "SKIPPED", emailError: null },
      });
      result.skipped += 1;
      continue;
    }

    // Claim it before sending. If the process dies mid-send the attempt is
    // still counted, so a poison row cannot be retried forever.
    await prisma.notification.update({
      where: { id: notification.id },
      data: { emailAttempts: { increment: 1 } },
    });

    const message = renderNotificationEmail({
      recipientName: user.name,
      title: notification.title,
      body: notification.body,
      kind: notification.kind,
      appUrl,
      entityType: notification.entityType,
      entityId: notification.entityId,
    });

    const outcome = await sendEmail({ to: user.email, ...message });

    if (outcome.outcome === "sent") {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailStatus: "SENT",
          emailSentAt: new Date(),
          emailMessageId: outcome.messageId,
          emailError: null,
        },
      });
      result.sent += 1;
    } else if (outcome.outcome === "skipped") {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "SKIPPED", emailError: null },
      });
      result.skipped += 1;
    } else {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: "FAILED", emailError: outcome.error },
      });
      result.failed += 1;
    }
  }

  if (result.failed > 0) {
    logger.warn("Email dispatch finished with failures", {
      sent: result.sent,
      failed: result.failed,
    });
  }

  return result;
}

/**
 * Fire-and-forget dispatch for the request path.
 *
 * Never throws and never awaited by the caller's critical work: a leave
 * request is committed before anyone tries to email about it, and an email
 * failing must not undo one.
 */
export function dispatchEmailsInBackground(limit = 25): void {
  void dispatchPendingEmails({ limit }).catch((error: unknown) => {
    logger.error("Background email dispatch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
