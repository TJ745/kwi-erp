import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { NotFoundError } from "@/lib/result";
import { crossedThreshold, DEFAULT_WARNING_DAYS, expiryCutoff } from "@/lib/expiry";
import {
  buildDedupeKey,
  describeThreshold,
  resolveRecipients,
  severityForThreshold,
} from "@/lib/notification-rules";
import { logger } from "@/server/logger";
import { CLOSED_STATUSES } from "./tasks";
import { reconcileExpiryIndex } from "./expiry";

/**
 * Reminder engine — brief §33.
 *
 * One scan over the ExpiryIndex projection covers all eleven expiry sources.
 * Without ADR-005 this would be an eleven-way UNION re-implemented per source.
 *
 * Duplicate suppression is a UNIQUE constraint on Notification.dedupeKey, not a
 * pre-check: the scan can be retried, redeployed mid-run, or triggered twice in
 * a day without producing a second alert.
 */

export type ScanResult = {
  scanned: number;
  created: number;
  skipped: number;
  reconciled: { scanned: number; created: number; updated: number; deactivated: number };
};

/**
 * Runs the nightly reminder scan.
 *
 * Deliberately NOT company-scoped: it runs as the system, and each notification
 * is addressed to a specific user whose own scope governs what they can then
 * open.
 */
export async function runExpiryScan(options: { now?: Date } = {}): Promise<ScanResult> {
  const now = options.now ?? new Date();

  // Self-healing first (ADR-005): correct any drift before deciding who to
  // alert, so a missed syncExpiry does not also mean a missed reminder.
  const reconciled = await reconcileExpiryIndex();

  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true, kind: "EXPIRY" },
    select: { id: true, source: true, thresholds: true, roleIds: true },
  });

  if (rules.length === 0) {
    logger.warn("Expiry scan ran with no active rules; no reminders will be sent");
    return { scanned: 0, created: 0, skipped: 0, reconciled };
  }

  // Recipients are resolved once per scan rather than per item.
  const roleIds = [...new Set(rules.flatMap((r) => r.roleIds))];
  const users = await prisma.user.findMany({
    where: { roleId: { in: roleIds }, status: "ACTIVE", deletedAt: null },
    select: { id: true, roleId: true },
  });

  const usersByRole = new Map<string, string[]>();
  for (const user of users) {
    usersByRole.set(user.roleId, [...(usersByRole.get(user.roleId) ?? []), user.id]);
  }

  // The widest threshold across all rules bounds the query.
  const widest = Math.max(
    ...rules.flatMap((r) => (r.thresholds.length > 0 ? r.thresholds : [...DEFAULT_WARNING_DAYS])),
  );

  const items = await prisma.expiryIndex.findMany({
    where: { isActive: true, expiryDate: { lte: expiryCutoff(widest, now) } },
    select: {
      id: true,
      source: true,
      sourceId: true,
      label: true,
      expiryDate: true,
      companyId: true,
      employeeId: true,
      warningDays: true,
    },
  });

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    // A rule may target one source specifically, or all of them (source null).
    const rule =
      rules.find((r) => r.source === item.source) ?? rules.find((r) => r.source === null);
    if (!rule) {
      skipped += 1;
      continue;
    }

    const thresholds = rule.thresholds.length > 0 ? rule.thresholds : item.warningDays;
    const threshold = crossedThreshold(item.expiryDate, thresholds, now);

    // Not yet inside any window.
    if (threshold === null) {
      skipped += 1;
      continue;
    }

    const recipients = resolveRecipients({ ruleRoleIds: rule.roleIds, usersByRole });
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const severity = severityForThreshold(threshold);
    const title = `${item.label} ${describeThreshold(threshold)}`;

    const rows: Prisma.NotificationCreateManyInput[] = recipients.map((userId) => ({
      userId,
      kind: "EXPIRY",
      severity,
      title,
      body: `Expires ${item.expiryDate.toISOString().slice(0, 10)}.`,
      entityType: item.employeeId ? ("EMPLOYEE" as const) : null,
      entityId: item.employeeId,
      dedupeKey: buildDedupeKey({
        source: item.source,
        sourceId: item.sourceId,
        threshold,
        userId,
      }),
    }));

    // skipDuplicates relies on the unique dedupeKey — this is what makes the
    // whole scan idempotent.
    const result = await prisma.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });

    created += result.count;
    skipped += rows.length - result.count;
  }

  const summary: ScanResult = { scanned: items.length, created, skipped, reconciled };
  logger.info("Expiry scan complete", { ...summary, reconciled: undefined });
  return summary;
}

/** Overdue-task reminders, run on the same schedule. */
export async function runOverdueTaskScan(options: { now?: Date } = {}): Promise<{
  scanned: number;
  created: number;
}> {
  const now = options.now ?? new Date();

  const overdue = await prisma.task.findMany({
    where: {
      status: { notIn: CLOSED_STATUSES },
      dueDate: { lt: now },
      assignedToId: { not: null },
    },
    select: { id: true, taskNo: true, title: true, dueDate: true, assignedToId: true },
  });

  const rows: Prisma.NotificationCreateManyInput[] = overdue
    .filter((task): task is typeof task & { assignedToId: string } => task.assignedToId !== null)
    .map((task) => ({
      userId: task.assignedToId,
      kind: "TASK_OVERDUE",
      severity: "WARNING" as const,
      title: `${task.taskNo} is overdue: ${task.title}`,
      body: task.dueDate ? `Was due ${task.dueDate.toISOString().slice(0, 10)}.` : null,
      entityType: "TASK" as const,
      entityId: task.id,
      // Date-stamped so an overdue task nags once per day rather than once ever
      // — the opposite trade-off from expiry alerts, and the right one here.
      dedupeKey: `TASK_OVERDUE:${task.id}:${now.toISOString().slice(0, 10)}:${task.assignedToId}`,
    }));

  if (rows.length === 0) return { scanned: 0, created: 0 };

  const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  return { scanned: overdue.length, created: result.count };
}

// --- Read side ---------------------------------------------------------------

export async function listNotifications(
  ctx: ActorContext,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  return prisma.notification.findMany({
    where: {
      userId: ctx.userId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: options.limit ?? 100,
    select: {
      id: true,
      kind: true,
      severity: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function unreadCount(ctx: ActorContext): Promise<number> {
  return prisma.notification.count({ where: { userId: ctx.userId, readAt: null } });
}

/** Scoped to the actor: you can only mark your own notifications read. */
export async function markRead(ctx: ActorContext, id: string) {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (count === 0) throw new NotFoundError("Notification not found.");
}

export async function markAllRead(ctx: ActorContext): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

/** Housekeeping: read notifications older than 90 days are noise. */
export async function pruneNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.notification.deleteMany({
    where: { readAt: { not: null, lt: cutoff } },
  });
  return count;
}
