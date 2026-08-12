import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/server/logger";
import { recordSystemAudit } from "@/server/audit/log";
import { pruneRateLimits } from "@/server/auth/rate-limit";
import {
  pruneNotifications,
  runExpiryScan,
  runOverdueTaskScan,
} from "@/server/services/notifications";

// Prisma and the reconciliation pass need the Node.js runtime.
export const runtime = "nodejs";
// Never cached: this mutates.
export const dynamic = "force-dynamic";
// The scan touches every expiry source; give it room on Vercel.
export const maxDuration = 300;

/**
 * Nightly automation — brief §33.
 *
 * Triggered by Vercel Cron (see vercel.json). Protected by a shared secret
 * compared in constant time: a plain `===` on a secret leaks its prefix through
 * timing, and this endpoint is internet-reachable.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    // Deliberately terse. An attacker learns nothing about why it failed.
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // Sequential, not parallel: the expiry scan reconciles the projection
    // first, and the task scan should see that settled state.
    const expiry = await runExpiryScan();
    const tasks = await runOverdueTaskScan();
    const prunedNotifications = await pruneNotifications();
    const prunedRateLimits = await pruneRateLimits();

    const durationMs = Date.now() - startedAt;

    const summary = {
      durationMs,
      expiryScanned: expiry.scanned,
      expiryNotificationsCreated: expiry.created,
      expirySkipped: expiry.skipped,
      reconciledCreated: expiry.reconciled.created,
      reconciledUpdated: expiry.reconciled.updated,
      reconciledDeactivated: expiry.reconciled.deactivated,
      overdueTasks: tasks.scanned,
      taskNotificationsCreated: tasks.created,
      prunedNotifications,
      prunedRateLimits,
    };

    logger.info("Cron: expiry scan finished", summary);

    // Recorded so "did the reminders run last night?" is answerable from the
    // audit log rather than from platform logs the business cannot see.
    await recordSystemAudit({
      action: "GENERATE",
      entityType: "USER",
      entityId: "system",
      actorLabel: "System (cron)",
      summary:
        `Expiry scan: ${String(expiry.created)} reminder(s), ` +
        `${String(tasks.created)} overdue task alert(s), ` +
        `${String(durationMs)}ms`,
    });

    return NextResponse.json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Cron: expiry scan failed", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    // A 500 makes Vercel surface the failed run rather than reporting success.
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}

/**
 * Accepts either the `Authorization: Bearer <secret>` header we document, or
 * Vercel Cron's own `x-vercel-cron` header on a request that already carries
 * the secret.
 */
function isAuthorised(request: NextRequest): boolean {
  const expected = getEnv().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (provided.length === 0) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
