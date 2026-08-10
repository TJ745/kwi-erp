import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { softDeleteExtension } from "./extensions";

/**
 * Prisma 7 requires an explicit driver adapter — connection URLs no longer live
 * in schema.prisma. The pooled Neon URL is used at runtime; migrations use the
 * direct URL via prisma.config.ts.
 */
function createPrismaClient() {
  const env = getEnv();
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
        : [{ emit: "stdout", level: "error" }],
  }).$extends(softDeleteExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Next.js dev-mode hot reload would otherwise open a new pool on every change.
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (getEnv().NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
