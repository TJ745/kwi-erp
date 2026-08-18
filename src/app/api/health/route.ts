import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health check.
 *
 * `getEnv()` validates lazily — on first call, not at import — because eager
 * validation runs during `next build`, where production secrets are legitimately
 * absent. The consequence is that a deploy with a missing or malformed secret
 * still serves the pages that do not need it: verified by starting a production
 * server with an invalid `BETTER_AUTH_SECRET`, which served `/login` with HTTP
 * 200 while being unable to authenticate anyone.
 *
 * This endpoint exists so that failure is findable on purpose. Hit it after
 * every deploy (docs/DEVELOPMENT.md §5a).
 *
 * Every dependency is imported INSIDE the handler. The obvious version, with
 * imports at the top, returned an unstructured 500 when the environment was
 * broken — the module graph pulled in `getEnv()` at import time and the route
 * failed before its own try/catch existed. A health check that cannot run when
 * something is wrong is the one route where that matters most.
 *
 * Unauthenticated by design — it is the check that runs before anyone can sign
 * in — so it reports only whether each dependency answered, never a value, a
 * connection string, or a version number.
 */
export async function GET() {
  const checks: Record<string, "ok" | "failed"> = {};
  let healthy = true;

  // 1. Configuration. The reason goes to the log; the response says only that
  //    it failed, because this endpoint is public.
  try {
    const { getEnv } = await import("@/lib/env");
    getEnv();
    checks.environment = "ok";
  } catch (error) {
    checks.environment = "failed";
    healthy = false;
    await logFailure("environment invalid", error);
  }

  // 2. Database reachability — a trivial query, not a check of any one table.
  try {
    const { prisma } = await import("@/server/db/client");
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (error) {
    checks.database = "failed";
    healthy = false;
    await logFailure("database unreachable", error);
  }

  // 3. Storage tier is reported, not judged: the free tier is a documented,
  //    accepted risk (SECURITY.md §6.0), not a failure.
  let storageTier: string | null = null;
  try {
    const storage = await import("@/server/storage/uploadthing");
    storageTier = storage.storageTier();
  } catch {
    storageTier = null;
  }

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, storageTier },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** Logging is itself best-effort: the logger may depend on the broken config. */
async function logFailure(what: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const { logger } = await import("@/server/logger");
    logger.error(`Health check: ${what}`, { error: message });
  } catch {
    console.error(`Health check: ${what}`, message);
  }
}
