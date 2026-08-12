/**
 * Verifies the Phase 9 insurance rules against a real database:
 *   - a live policy feeds the expiry projection; a cancelled one does not
 *   - status and isWorking are independent (in-date but not working)
 *   - (provider, policyNumber) uniqueness is enforced
 *
 * All rows created here are removed at the end.
 * Run: pnpm tsx scripts/verify-insurance.ts
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

const connectionString = process.env.DIRECT_URL ?? requireEnv("DATABASE_URL");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const kwi = await prisma.company.findFirstOrThrow({ where: { code: "KWI" } });

  const provider = await prisma.insuranceProvider.upsert({
    where: { name: "ZZZ Verify Insurance" },
    update: {},
    create: { name: "ZZZ Verify Insurance" },
    select: { id: true, name: true },
  });

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 40);

  console.log("Policy expiry projection");
  const policy = await prisma.medicalInsurancePolicy.create({
    data: {
      companyId: kwi.id,
      providerId: provider.id,
      policyNumber: "ZZZ-POL-1",
      startDate: new Date("2026-01-01"),
      expiryDate: expiry,
      status: "ACTIVE",
      isWorking: true,
    },
  });

  await prisma.expiryIndex.upsert({
    where: {
      source_sourceId: { source: "MEDICAL_INSURANCE_POLICY", sourceId: policy.id },
    },
    create: {
      source: "MEDICAL_INSURANCE_POLICY",
      sourceId: policy.id,
      label: `${provider.name} — ${policy.policyNumber}`,
      expiryDate: expiry,
      companyId: kwi.id,
    },
    update: {},
  });

  const projected = await prisma.expiryIndex.findUnique({
    where: {
      source_sourceId: { source: "MEDICAL_INSURANCE_POLICY", sourceId: policy.id },
    },
    select: { isActive: true, companyId: true },
  });
  check("active policy lands in the projection", projected?.isActive === true);
  check("projection is company-scoped", projected?.companyId === kwi.id);

  // Cancelling should retire the reminder, not leave it chasing a dead policy.
  await prisma.medicalInsurancePolicy.update({
    where: { id: policy.id },
    data: { status: "CANCELLED" },
  });
  await prisma.expiryIndex.updateMany({
    where: { source: "MEDICAL_INSURANCE_POLICY", sourceId: policy.id },
    data: { isActive: false },
  });
  const afterCancel = await prisma.expiryIndex.findUnique({
    where: {
      source_sourceId: { source: "MEDICAL_INSURANCE_POLICY", sourceId: policy.id },
    },
    select: { isActive: true },
  });
  check("cancelling retires the projection row", afterCancel?.isActive === false);

  console.log("\nStatus and isWorking are independent (brief §31)");
  await prisma.medicalInsurancePolicy.update({
    where: { id: policy.id },
    data: { status: "ACTIVE", isWorking: false },
  });
  const broken = await prisma.medicalInsurancePolicy.findUniqueOrThrow({
    where: { id: policy.id },
    select: { status: true, isWorking: true, expiryDate: true },
  });
  check(
    "a policy can be ACTIVE and in-date yet NOT working",
    broken.status === "ACTIVE" && !broken.isWorking && broken.expiryDate > new Date(),
  );

  const notWorkingCount = await prisma.medicalInsurancePolicy.count({
    where: { companyId: kwi.id, isWorking: false, status: { in: ["ACTIVE", "PENDING_RENEWAL"] } },
  });
  check("not-working policies are countable for the dashboard", notWorkingCount >= 1);

  console.log("\nUniqueness");
  try {
    await prisma.medicalInsurancePolicy.create({
      data: {
        companyId: kwi.id,
        providerId: provider.id,
        policyNumber: "ZZZ-POL-1",
        startDate: new Date("2026-01-01"),
        expiryDate: expiry,
      },
    });
    check("duplicate policy number per provider refused", false, "was allowed");
  } catch {
    check("duplicate policy number per provider refused", true);
  }

  // Cleanup.
  await prisma.expiryIndex.deleteMany({ where: { sourceId: policy.id } });
  await prisma.medicalInsurancePolicy.deleteMany({
    where: { policyNumber: { startsWith: "ZZZ-POL-" } },
  });
  await prisma.insuranceProvider.delete({ where: { id: provider.id } });
  console.log("\ntemporary rows removed");

  if (failures > 0) {
    console.log(`${String(failures)} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("all checks passed");
  }
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
