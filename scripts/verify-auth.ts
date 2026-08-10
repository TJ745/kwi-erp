/**
 * Inspects what the auth flow recorded. Read-only.
 * Run: pnpm tsx scripts/verify-auth.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  const audits = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      action: true,
      entityType: true,
      actorLabel: true,
      summary: true,
      ipAddress: true,
      changes: true,
      createdAt: true,
    },
  });

  console.log("Recent audit entries");
  for (const a of audits) {
    console.log(
      `  ${a.createdAt.toISOString()}  ${a.action.padEnd(12)} ${a.actorLabel.padEnd(34)} ${a.summary}`,
    );
  }

  const sessions = await prisma.session.count();
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@example.local" },
    select: { failedLoginCount: true, lastLoginAt: true, lockedUntil: true, status: true },
  });

  console.log(`\nSessions in database: ${sessions}`);
  console.log(`Admin: status=${user.status} failedLoginCount=${user.failedLoginCount}`);
  console.log(`       lastLoginAt=${user.lastLoginAt?.toISOString() ?? "never"}`);
  console.log(`       lockedUntil=${user.lockedUntil?.toISOString() ?? "not locked"}`);

  const buckets = await prisma.rateLimitBucket.findMany({
    select: { key: true, count: true, expiresAt: true },
  });
  console.log(`\nRate limit buckets: ${buckets.length}`);
  for (const b of buckets) console.log(`  ${b.key} = ${b.count}`);

  // Nothing resembling a password may ever appear in an audit payload.
  const withChanges = await prisma.auditLog.findMany({
    select: { changes: true, summary: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  const serialised = JSON.stringify(withChanges);
  const leaked = ["ChangeMe-Dev-Only", "npg_", "$argon2"].filter((s) => serialised.includes(s));
  console.log(`\nSecret leakage into audit payloads: ${leaked.length === 0 ? "none" : leaked.join(", ")}`);
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
