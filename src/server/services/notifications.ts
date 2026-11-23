import "server-only";
import type { EntityType, Prisma } from "@/generated/prisma/client";
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
import { resolvePermissions, SUPER_ADMIN_ROLE_KEY, type PermissionKey } from "@/lib/permissions";
import { reconcileExpiryIndex } from "./expiry";
import { dispatchEmailsInBackground } from "@/server/email/dispatch";

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

// --- Event-driven notifications ----------------------------------------------

/**
 * The users who effectively hold a permission, optionally narrowed to those
 * who can see a given company.
 *
 * Effective, not nominal: role grants are combined with per-user overrides
 * through the same `resolvePermissions` the request context uses, so a DENY
 * override removes someone from the list and an ALLOW override adds them. A
 * notification sent to someone who cannot open the record is worse than none —
 * they get an alert and then a 404.
 *
 * The user table is small (tens of rows), so this is one query rather than a
 * cached projection. If it ever stops being small, this is the place to cache.
 */
export async function usersWithPermission(
  permission: PermissionKey,
  options: { companyId?: string | null } = {},
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      role: {
        select: {
          key: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      overrides: {
        select: {
          effect: true,
          expiresAt: true,
          permission: { select: { key: true } },
        },
      },
      companyAccess: { select: { companyId: true } },
    },
  });

  const recipients: string[] = [];

  for (const user of users) {
    const permissions = resolvePermissions({
      rolePermissions: user.role.permissions.map((rp) => rp.permission.key),
      overrides: user.overrides.map((o) => ({
        key: o.permission.key,
        effect: o.effect,
        expiresAt: o.expiresAt,
      })),
      isSuperAdmin: user.role.key === SUPER_ADMIN_ROLE_KEY,
    });

    if (!permissions.has(permission)) continue;

    // Company scope, mirroring `ActorContext`: companies.viewAll sees
    // everything, otherwise the explicit access list decides.
    if (options.companyId) {
      const seesAll = permissions.has("companies.viewAll");
      const inScope = user.companyAccess.some((a) => a.companyId === options.companyId);
      if (!seesAll && !inScope) continue;
    }

    recipients.push(user.id);
  }

  return recipients;
}

/**
 * Raises a notification for everyone who can act on something.
 *
 * Never throws. A notification is a courtesy on top of a record that has
 * already been written — failing to send one must not roll back a leave
 * request or an increment, so every failure is logged and swallowed.
 * The record is still visible on its own page either way.
 */
export async function notifyUsers(input: {
  userIds: readonly string[];
  kind: "APPROVAL_REQUIRED" | "MENTION" | "SYSTEM";
  severity?: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body?: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  /** Stable per (event, user), so a retry cannot double-notify. */
  dedupeKeyPrefix: string;
  /** Usually the actor: nobody needs telling about their own action. */
  excludeUserId?: string | undefined;
}): Promise<number> {
  try {
    const targets = [...new Set(input.userIds)].filter((id) => id !== input.excludeUserId);
    if (targets.length === 0) return 0;

    const rows: Prisma.NotificationCreateManyInput[] = targets.map((userId) => ({
      userId,
      kind: input.kind,
      severity: input.severity ?? "INFO",
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      dedupeKey: `${input.dedupeKeyPrefix}:${userId}`,
    }));

    const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });

    // Emailed out of band. The notification row is already committed, so a
    // provider outage delays the message rather than failing the action that
    // caused it; the nightly sweep retries whatever did not go.
    if (result.count > 0) dispatchEmailsInBackground();

    return result.count;
  } catch (error) {
    logger.error("Failed to raise notifications", {
      kind: input.kind,
      dedupeKeyPrefix: input.dedupeKeyPrefix,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Someone raised something that needs a decision.
 *
 * Approvals were the largest gap in the reminder engine: leave and increments
 * both had an approval step and none of them told the approver, so
 * the queue only moved when somebody happened to open the page.
 */
export async function notifyApprovalRequired(input: {
  permission: PermissionKey;
  companyId: string | null;
  title: string;
  body?: string | null;
  entityType?: EntityType | null;
  entityId: string;
  dedupeKeyPrefix: string;
  requestedById: string;
}): Promise<number> {
  try {
    const userIds = await usersWithPermission(input.permission, {
      companyId: input.companyId,
    });

    return await notifyUsers({
      userIds,
      kind: "APPROVAL_REQUIRED",
      severity: "INFO",
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId,
      dedupeKeyPrefix: input.dedupeKeyPrefix,
      // Self-approval is refused by the services anyway, so telling the
      // requester their own request needs approval would be pure noise.
      excludeUserId: input.requestedById,
    });
  } catch (error) {
    logger.error("Failed to raise approval notifications", {
      entityId: input.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
