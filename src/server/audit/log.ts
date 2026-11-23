import "server-only";
import type { AuditAction, EntityType } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { diffRecords, type ChangeSet } from "./redact";

/**
 * Central audit writer — docs/SECURITY.md §7.
 *
 * Insert-only: there is deliberately no update or delete helper here, and no
 * code path elsewhere that mutates AuditLog.
 */

export type AuditInput = {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  companyId?: string | null;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Pre-built change set, when a diff is not the right representation. */
  changes?: ChangeSet;
};

type AuditClient = Pick<typeof prisma, "auditLog">;

/**
 * Writes one audit entry. Accepts a transaction client so the entry commits or
 * rolls back with the operation it describes.
 */
export async function recordAudit(
  ctx: ActorContext,
  input: AuditInput,
  client: AuditClient = prisma,
): Promise<void> {
  const changes =
    input.changes ??
    (input.before || input.after
      ? diffRecords(input.before ?? null, input.after ?? null)
      : undefined);

  // An update that changed nothing is noise; don't record it.
  if (input.action === "UPDATE" && changes && Object.keys(changes).length === 0) return;

  const hasChanges = changes !== undefined && Object.keys(changes).length > 0;

  await client.auditLog.create({
    data: {
      actorUserId: ctx.userId,
      // Denormalised so the trail stays readable after a user is removed.
      actorLabel: `${ctx.name} <${ctx.email}>`,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      companyId: input.companyId ?? null,
      summary: input.summary,
      // Key omitted entirely when empty — exactOptionalPropertyTypes forbids
      // passing an explicit `undefined` here.
      ...(hasChanges ? { changes } : {}),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}

/**
 * Audit entry for an actor-less event (failed login, cron job), where there is
 * no session to build an ActorContext from.
 */
export async function recordSystemAudit(input: {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  actorLabel: string;
  summary: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: null,
      actorLabel: input.actorLabel,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
