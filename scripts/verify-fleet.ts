/**
 * Verifies the Phase 8 fleet rules against a real database:
 *   - one vehicle feeds TWO independent expiry projection rows
 *   - a vehicle has one active driver (partial unique index), including
 *     under concurrency
 *   - unassigning frees it for reassignment
 *
 * All rows created here are removed at the end.
 * Run: pnpm tsx scripts/verify-fleet.ts
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
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@example.local" } });

  const base = {
    companyId: kwi.id,
    gender: "MALE" as const,
    nationality: "PK",
    joiningDate: new Date("2025-01-01"),
  };
  const alice = await prisma.employee.create({
    data: { ...base, employeeNo: "ZZZ-FL-A", firstName: "Alice", lastName: "Drive", fullName: "Alice Drive" },
  });
  const bob = await prisma.employee.create({
    data: { ...base, employeeNo: "ZZZ-FL-B", firstName: "Bob", lastName: "Drive", fullName: "Bob Drive" },
  });

  const regExpiry = new Date();
  regExpiry.setDate(regExpiry.getDate() + 25);
  const insExpiry = new Date();
  insExpiry.setDate(insExpiry.getDate() + 70);

  const vehicle = await prisma.vehicle.create({
    data: {
      vehicleCode: "ZZZ-VEH-1",
      plateNumber: "ZZZ-9999",
      make: "Verify",
      model: "Fleet",
      year: 2024,
      companyId: kwi.id,
      registrationExpiry: regExpiry,
      insuranceExpiry: insExpiry,
    },
  });

  console.log("Dual expiry projection (one vehicle, two sources)");
  for (const [source, date, label] of [
    ["VEHICLE_REGISTRATION", regExpiry, "Registration"],
    ["VEHICLE_INSURANCE", insExpiry, "Insurance"],
  ] as const) {
    await prisma.expiryIndex.upsert({
      where: { source_sourceId: { source, sourceId: vehicle.id } },
      create: {
        source,
        sourceId: vehicle.id,
        label: `${label} — ${vehicle.plateNumber}`,
        expiryDate: date,
        companyId: kwi.id,
        vehicleId: vehicle.id,
      },
      update: {},
    });
  }

  const projections = await prisma.expiryIndex.findMany({
    where: { vehicleId: vehicle.id },
    select: { source: true, expiryDate: true },
    orderBy: { source: "asc" },
  });
  check("two projection rows for one vehicle", projections.length === 2, projections.map((p) => p.source).join(", "));
  check(
    "the two rows carry different dates",
    projections[0]?.expiryDate.getTime() !== projections[1]?.expiryDate.getTime(),
  );

  console.log("\nSingle active driver (partial unique index)");
  await prisma.vehicleAssignment.create({
    data: {
      vehicleId: vehicle.id,
      employeeId: alice.id,
      assignedAt: new Date(),
      assignedById: admin.id,
    },
  });
  check("first assignment succeeds", true);

  try {
    await prisma.vehicleAssignment.create({
      data: {
        vehicleId: vehicle.id,
        employeeId: bob.id,
        assignedAt: new Date(),
        assignedById: admin.id,
      },
    });
    check("second driver while still assigned is refused", false, "was allowed");
  } catch {
    check("second driver while still assigned is refused", true);
  }

  console.log("\nUnassign frees the vehicle");
  await prisma.vehicleAssignment.updateMany({
    where: { vehicleId: vehicle.id, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });
  await prisma.vehicleAssignment.create({
    data: {
      vehicleId: vehicle.id,
      employeeId: bob.id,
      assignedAt: new Date(),
      assignedById: admin.id,
    },
  });
  const open = await prisma.vehicleAssignment.count({
    where: { vehicleId: vehicle.id, unassignedAt: null },
  });
  check("reassignment succeeds, exactly one open", open === 1);

  // The case a service-layer check alone would miss.
  console.log("\nConcurrent double-assignment");
  await prisma.vehicleAssignment.updateMany({
    where: { vehicleId: vehicle.id, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });

  const attempts = await Promise.allSettled([
    prisma.vehicleAssignment.create({
      data: { vehicleId: vehicle.id, employeeId: alice.id, assignedAt: new Date(), assignedById: admin.id },
    }),
    prisma.vehicleAssignment.create({
      data: { vehicleId: vehicle.id, employeeId: bob.id, assignedAt: new Date(), assignedById: admin.id },
    }),
  ]);
  const succeeded = attempts.filter((a) => a.status === "fulfilled").length;
  check(
    "exactly one of two concurrent assignments succeeds",
    succeeded === 1,
    `${String(succeeded)} succeeded`,
  );

  // Cleanup.
  await prisma.vehicleAssignment.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.expiryIndex.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
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
