/**
 * Inspects what the reminder scan produced. Read-only.
 * Run: pnpm tsx scripts/verify-notifications.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({
    connectionString: process.env.DIRECT_URL ?? requireEnv("DATABASE_URL"),
  }),
});

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      severity: true,
      title: true,
      dedupeKey: true,
      userId: true,
      readAt: true,
    },
  });

  console.log(`Notifications generated: ${String(notifications.length)}\n`);
  for (const n of notifications.slice(0, 10)) {
    console.log(`  [${n.severity.padEnd(8)}] ${n.title}`);
  }

  console.log("\nIntegrity");
  const keys = notifications.map((n) => n.dedupeKey);
  check("every dedupe key is unique", new Set(keys).size === keys.length);

  // A key is source:sourceId:threshold:userId — four parts, so a colon inside
  // a cuid would show up here.
  const wellFormed = keys.every((k) => k.split(":").length === 4);
  check("dedupe keys are well formed", wellFormed);

  console.log("\nSeverity matches the threshold in the key");
  let severityOk = true;
  for (const n of notifications) {
    const parts = n.dedupeKey.split(":");
    const threshold = Number(parts[2]);
    if (Number.isNaN(threshold)) continue;
    const expected =
      threshold <= 7 ? "CRITICAL" : threshold <= 30 ? "WARNING" : "INFO";
    if (n.severity !== expected) {
      console.log(`    mismatch: threshold ${String(threshold)} -> ${n.severity}, expected ${expected}`);
      severityOk = false;
    }
  }
  check("severity escalates correctly", severityOk);

  console.log("\nRouting");
  const recipients = await prisma.user.findMany({
    where: { id: { in: [...new Set(notifications.map((n) => n.userId))] } },
    select: { id: true, name: true, role: { select: { key: true } } },
  });
  for (const r of recipients) {
    const count = notifications.filter((n) => n.userId === r.id).length;
    console.log(`  ${r.name} (${r.role.key}): ${String(count)}`);
  }
  check("notifications were routed to at least one user", recipients.length > 0);

  // Rules target HR and ADMIN; a VIEWER should never be a recipient.
  const viewers = recipients.filter((r) => r.role.key === "VIEWER");
  check("no notifications routed to VIEWER", viewers.length === 0);

  console.log("\nProjection coverage");
  const bySource = await prisma.expiryIndex.groupBy({
    by: ["source"],
    where: { isActive: true },
    _count: true,
  });
  for (const s of bySource) {
    console.log(`  ${s.source}: ${String(s._count)}`);
  }

  if (failures > 0) {
    console.log(`\n${String(failures)} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("\nall checks passed");
  }
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
