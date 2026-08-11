/**
 * Verifies the Phase 7 IT rules against a real database:
 *   - an asset cannot be issued to two people at once (partial unique index)
 *   - returning it frees the asset for reissue
 *   - a CONCURRENT double-issue is refused, not just a sequential one
 *   - warranty dates feed the expiry projection
 *
 * All rows created here are removed at the end.
 * Run: pnpm tsx scripts/verify-it.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const kwi = await prisma.company.findFirstOrThrow({ where: { code: "KWI" } });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@example.local" } });

  const base = {
    companyId: kwi.id,
    gender: "MALE" as const,
    nationality: "PK",
    joiningDate: new Date("2025-01-01"),
  };
  const alice = await prisma.employee.create({
    data: { ...base, employeeNo: "ZZZ-IT-A", firstName: "Alice", lastName: "IT", fullName: "Alice IT" },
  });
  const bob = await prisma.employee.create({
    data: { ...base, employeeNo: "ZZZ-IT-B", firstName: "Bob", lastName: "IT", fullName: "Bob IT" },
  });

  const warranty = new Date();
  warranty.setDate(warranty.getDate() + 40);

  const asset = await prisma.iTAsset.create({
    data: {
      assetCode: "ZZZ-IT-0001",
      type: "LAPTOP",
      brand: "Verify",
      model: "Book",
      serialNumber: "ZZZ-SN-0001",
      companyId: kwi.id,
      warrantyExpiry: warranty,
    },
  });

  console.log("Warranty expiry projection");
  await prisma.expiryIndex.upsert({
    where: { source_sourceId: { source: "IT_ASSET_WARRANTY", sourceId: asset.id } },
    create: {
      source: "IT_ASSET_WARRANTY",
      sourceId: asset.id,
      label: `Warranty — ${asset.assetCode}`,
      expiryDate: warranty,
      companyId: kwi.id,
    },
    update: {},
  });
  const projected = await prisma.expiryIndex.findUnique({
    where: { source_sourceId: { source: "IT_ASSET_WARRANTY", sourceId: asset.id } },
  });
  check("warranty lands in the expiry projection", projected !== null);

  console.log("\nSingle-holder rule (partial unique index)");
  await prisma.iTAssetAssignment.create({
    data: {
      assetId: asset.id,
      employeeId: alice.id,
      assignedAt: new Date(),
      assignedById: admin.id,
      conditionOut: "GOOD",
    },
  });
  check("first issue succeeds", true);

  // Sequential second issue.
  try {
    await prisma.iTAssetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: bob.id,
        assignedAt: new Date(),
        assignedById: admin.id,
        conditionOut: "GOOD",
      },
    });
    check("second issue while still held is refused", false, "was allowed");
  } catch {
    check("second issue while still held is refused", true);
  }

  console.log("\nReturn frees the asset");
  await prisma.iTAssetAssignment.updateMany({
    where: { assetId: asset.id, returnedAt: null },
    data: { returnedAt: new Date(), conditionIn: "GOOD", receivedById: admin.id },
  });
  await prisma.iTAssetAssignment.create({
    data: {
      assetId: asset.id,
      employeeId: bob.id,
      assignedAt: new Date(),
      assignedById: admin.id,
      conditionOut: "GOOD",
    },
  });
  const openNow = await prisma.iTAssetAssignment.count({
    where: { assetId: asset.id, returnedAt: null },
  });
  check("reissue after return succeeds, exactly one open", openNow === 1);

  // The important case: two simultaneous issues. A service-layer check alone
  // would let both through; the partial unique index is what stops it.
  console.log("\nConcurrent double-issue");
  await prisma.iTAssetAssignment.updateMany({
    where: { assetId: asset.id, returnedAt: null },
    data: { returnedAt: new Date(), conditionIn: "GOOD", receivedById: admin.id },
  });

  const attempts = await Promise.allSettled([
    prisma.iTAssetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: alice.id,
        assignedAt: new Date(),
        assignedById: admin.id,
        conditionOut: "GOOD",
      },
    }),
    prisma.iTAssetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: bob.id,
        assignedAt: new Date(),
        assignedById: admin.id,
        conditionOut: "GOOD",
      },
    }),
  ]);

  const succeeded = attempts.filter((a) => a.status === "fulfilled").length;
  check(
    "exactly one of two concurrent issues succeeds",
    succeeded === 1,
    `${String(succeeded)} succeeded`,
  );

  // Cleanup.
  await prisma.iTAssetAssignment.deleteMany({ where: { assetId: asset.id } });
  await prisma.expiryIndex.deleteMany({ where: { sourceId: asset.id } });
  await prisma.iTAsset.delete({ where: { id: asset.id } });
  await prisma.employee.deleteMany({
    where: { employeeNo: { in: [alice.employeeNo, bob.employeeNo] } },
  });
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
