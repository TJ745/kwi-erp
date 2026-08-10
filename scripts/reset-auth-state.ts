/**
 * Development helper: clears audit entries, rate-limit buckets, and login
 * counters so an auth flow can be observed from a clean slate.
 *
 * Run: pnpm tsx scripts/reset-auth-state.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to clear audit history in production.");
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  const audits = await prisma.auditLog.deleteMany({});
  const buckets = await prisma.rateLimitBucket.deleteMany({});
  await prisma.user.updateMany({
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: null },
  });
  console.log(`cleared ${audits.count} audit entries, ${buckets.count} rate-limit buckets`);
  console.log("reset login counters on all users");
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
