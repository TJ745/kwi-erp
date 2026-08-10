/**
 * One-off verification that the hand-written constraints migration actually
 * enforces the business rules from docs/MODULES.md §7 against a real database.
 *
 * Run: pnpm tsx scripts/verify-constraints.ts
 * Safe to re-run: every row it creates is removed at the end.
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

let failures = 0;

async function expectRejected(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  FAIL  ${label} — ALLOWED, but should have been rejected`);
    failures += 1;
  } catch {
    console.log(`  ok    ${label}`);
  }
}

async function main() {
  // --- Schema objects present ---------------------------------------------
  const partials = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    // ::text — Postgres' internal `name` type has no Prisma mapping.
    `SELECT indexname::text AS indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN
     ('it_asset_single_active_assignment','vehicle_single_active_driver','bed_single_active_occupant')`,
  );
  const checks = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM pg_constraint
     WHERE contype='c' AND connamespace='public'::regnamespace AND conname NOT LIKE '%_not_null'`,
  );
  const trgm = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE '%gin_trgm_ops%'`,
  );
  const tables = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`,
  );

  console.log("Schema objects");
  console.log(`  tables                  ${tables[0]!.n}`);
  console.log(`  partial unique indexes  ${partials.length}/3`);
  console.log(`  CHECK constraints       ${checks[0]!.n}`);
  console.log(`  trigram indexes         ${trgm[0]!.n}`);
  if (partials.length !== 3) failures += 1;

  // --- Business rules ------------------------------------------------------
  console.log("\nBusiness rules (each of these MUST be rejected)");

  const company = await prisma.company.findFirstOrThrow({ where: { code: "KWI" } });
  const leaveType = await prisma.leaveType.findFirstOrThrow();
  const category = await prisma.credentialCategory.findFirstOrThrow();

  const base = {
    companyId: company.id,
    gender: "MALE",
    nationality: "SA",
    joiningDate: new Date(),
  } as const;

  const e1 = await prisma.employee.create({
    data: { ...base, employeeNo: "ZZZ-TMP-A", firstName: "A", lastName: "Temp", fullName: "A Temp" },
  });
  const e2 = await prisma.employee.create({
    data: { ...base, employeeNo: "ZZZ-TMP-B", firstName: "B", lastName: "Temp", fullName: "B Temp" },
  });
  const asset = await prisma.iTAsset.create({
    data: { assetCode: "ZZZ-TMP-IT", type: "LAPTOP", brand: "X", model: "Y", companyId: company.id },
  });

  await prisma.iTAssetAssignment.create({
    data: {
      assetId: asset.id,
      employeeId: e1.id,
      assignedAt: new Date(),
      assignedById: "verify",
      conditionOut: "GOOD",
    },
  });

  await expectRejected("asset assigned to a second employee while still out", () =>
    prisma.iTAssetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: e2.id,
        assignedAt: new Date(),
        assignedById: "verify",
        conditionOut: "GOOD",
      },
    }),
  );

  await expectRejected("leave request ending before it starts", () =>
    prisma.leaveRequest.create({
      data: {
        employeeId: e1.id,
        leaveTypeId: leaveType.id,
        startDate: new Date("2026-05-10"),
        endDate: new Date("2026-05-01"),
        days: 3,
        createdById: "verify",
      },
    }),
  );

  await expectRejected("iqama expiring before it was issued", () =>
    prisma.iqamaRecord.create({
      data: {
        employeeId: e1.id,
        iqamaNumber: "ZZZTMP123",
        profession: "Tester",
        issueDate: new Date("2026-05-10"),
        expiryDate: new Date("2026-01-01"),
      },
    }),
  );

  const ivWrong = Buffer.alloc(2);
  const tag = Buffer.alloc(16);
  await expectRejected("vault credential with a wrong-length IV", () =>
    prisma.credential.create({
      data: {
        name: "ZZZ-TMP",
        categoryId: category.id,
        ciphertext: Buffer.from("x"),
        iv: ivWrong,
        authTag: tag,
        wrappedDek: Buffer.from("k"),
        createdById: "verify",
        updatedById: "verify",
      },
    }),
  );

  await expectRejected("software licence using more seats than it owns", () =>
    prisma.softwareLicense.create({
      data: { name: "ZZZ-TMP", companyId: company.id, seats: 2, seatsUsed: 5 },
    }),
  );

  // --- Cleanup -------------------------------------------------------------
  await prisma.iTAssetAssignment.deleteMany({ where: { assetId: asset.id } });
  await prisma.iTAsset.delete({ where: { id: asset.id } });
  await prisma.employee.deleteMany({ where: { employeeNo: { in: [e1.employeeNo, e2.employeeNo] } } });
  console.log("\ntemporary rows removed");

  if (failures > 0) {
    console.log(`\n${failures} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("all constraints enforced as designed");
  }
}

main()
  .catch((e: unknown) => {
    console.error("verification error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
