/**
 * Exercises the employee + expiry pipeline against a real database.
 * Read-mostly: every row it creates is removed at the end.
 *
 * Run: pnpm tsx scripts/verify-employees.ts
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
  const icc = await prisma.company.findFirstOrThrow({ where: { code: "ICC" } });
  const dept = await prisma.department.findFirstOrThrow({ where: { companyId: kwi.id } });

  console.log("Business codes");
  const before = await prisma.counter.findUnique({ where: { key: "employee" } });
  const startValue = before?.value ?? 0;

  // Two concurrent creates must not collide on the sequence.
  const [a, b] = await Promise.all([
    prisma.$queryRaw<{ value: number }[]>`
      INSERT INTO "Counter" ("key","value","updatedAt") VALUES ('employee', 1, now())
      ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1, "updatedAt" = now()
      RETURNING "value"`,
    prisma.$queryRaw<{ value: number }[]>`
      INSERT INTO "Counter" ("key","value","updatedAt") VALUES ('employee', 1, now())
      ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1, "updatedAt" = now()
      RETURNING "value"`,
  ]);
  const values = [a[0]?.value, b[0]?.value];
  check("concurrent counter increments are distinct", values[0] !== values[1], values.join(" vs "));
  check("counter advanced by exactly 2", Math.max(...(values as number[])) === startValue + 2);

  console.log("\nEmployee + expiry projection");
  const employee = await prisma.employee.create({
    data: {
      employeeNo: "ZZZ-VERIFY-1",
      companyId: kwi.id,
      departmentId: dept.id,
      firstName: "Verify",
      lastName: "Employee",
      fullName: "Verify Employee",
      gender: "MALE",
      nationality: "PK",
      joiningDate: new Date("2026-01-01"),
      status: "ACTIVE",
    },
  });

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 20);

  const iqama = await prisma.iqamaRecord.create({
    data: {
      employeeId: employee.id,
      iqamaNumber: "9999999999",
      profession: "Verification Engineer",
      issueDate: new Date("2025-01-01"),
      expiryDate: expiry,
    },
  });

  await prisma.expiryIndex.upsert({
    where: { source_sourceId: { source: "IQAMA", sourceId: iqama.id } },
    create: {
      source: "IQAMA",
      sourceId: iqama.id,
      label: `Iqama — ${employee.fullName}`,
      expiryDate: expiry,
      employeeId: employee.id,
      companyId: kwi.id,
    },
    update: {},
  });

  const projected = await prisma.expiryIndex.findUnique({
    where: { source_sourceId: { source: "IQAMA", sourceId: iqama.id } },
  });
  check("expiry projection row created", projected !== null);
  check("projection carries the company for scoping", projected?.companyId === kwi.id);

  // Company scoping: an ICC-scoped query must not see this KWI employee.
  const iccVisible = await prisma.employee.count({
    where: { id: employee.id, companyId: { in: [icc.id] } },
  });
  check("KWI employee invisible to an ICC-scoped query", iccVisible === 0);

  const kwiVisible = await prisma.employee.count({
    where: { id: employee.id, companyId: { in: [kwi.id] } },
  });
  check("KWI employee visible to a KWI-scoped query", kwiVisible === 1);

  const scopedExpiry = await prisma.expiryIndex.count({
    where: { sourceId: iqama.id, companyId: { in: [icc.id] } },
  });
  check("expiry projection is company-scoped too", scopedExpiry === 0);

  console.log("\nDatabase-level rules");
  try {
    await prisma.iqamaRecord.create({
      data: {
        employeeId: employee.id,
        iqamaNumber: "8888888888",
        profession: "Duplicate",
        issueDate: new Date("2025-01-01"),
        expiryDate: expiry,
      },
    });
    check("second Iqama for the same employee rejected", false, "was allowed");
  } catch {
    check("second Iqama for the same employee rejected", true);
  }

  // Cleanup.
  await prisma.expiryIndex.deleteMany({ where: { sourceId: iqama.id } });
  await prisma.iqamaRecord.deleteMany({ where: { employeeId: employee.id } });
  await prisma.employee.delete({ where: { id: employee.id } });
  await prisma.counter.update({ where: { key: "employee" }, data: { value: startValue } });
  console.log("\ntemporary rows removed, counter restored");

  if (failures > 0) {
    console.log(`\n${failures} check(s) FAILED`);
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
