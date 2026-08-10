/**
 * Development helper: creates (or resets) a user with a given role so
 * authorisation boundaries can be exercised for real.
 *
 * Run: pnpm tsx scripts/make-test-user.ts VIEWER viewer@example.local
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create test users in production.");
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const roleKey = process.argv[2] ?? "VIEWER";
const email = process.argv[3] ?? `${roleKey.toLowerCase()}@example.local`;
const password = "TestUser-Dev-Only-123!";

async function main() {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { roleId: role.id, status: "ACTIVE" },
    create: {
      email,
      name: `Test ${roleKey}`,
      emailVerified: true,
      status: "ACTIVE",
      roleId: role.id,
    },
  });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    update: { password: passwordHash },
    create: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
    },
  });

  // Scope to KWI only, so cross-company isolation can be tested too.
  const kwi = await prisma.company.findUnique({ where: { code: "KWI" } });
  if (kwi) {
    await prisma.userCompanyAccess.upsert({
      where: { userId_companyId: { userId: user.id, companyId: kwi.id } },
      update: {},
      create: { userId: user.id, companyId: kwi.id },
    });
  }

  console.log(`${roleKey}: ${email} / ${password} (KWI only)`);
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
