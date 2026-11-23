/**
 * Removes the DEMO dashboard dataset.
 *
 * The dashboard was built against representative data, because an empty
 * database makes any layout look sparse for reasons that have nothing to do
 * with the layout. Everything that seeding created is prefixed DEMO, so this
 * removes exactly that and nothing else.
 *
 * Run: pnpm tsx scripts/remove-demo-data.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
const DEMO = { startsWith: "DEMO" };

async function main() {
  const counts: Record<string, number> = {};

  // Children before parents.
  const vehicles = await prisma.vehicle.findMany({
    where: { vehicleCode: DEMO },
    select: { id: true },
  });
  const vehicleIds = vehicles.map((v) => v.id);
  if (vehicleIds.length > 0) {
    await prisma.expiryIndex.deleteMany({ where: { sourceId: { in: vehicleIds } } });
    counts.vehicles = (await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } }))
      .count;
  }

  const accommodations = await prisma.accommodation.findMany({
    where: { name: DEMO },
    select: { id: true },
  });
  for (const a of accommodations) {
    const rooms = await prisma.accommodationRoom.findMany({
      where: { accommodationId: a.id },
      select: { id: true },
    });
    const roomIds = rooms.map((r) => r.id);
    const beds = await prisma.accommodationBed.findMany({
      where: { roomId: { in: roomIds } },
      select: { id: true },
    });
    await prisma.bedAssignment.deleteMany({ where: { bedId: { in: beds.map((b) => b.id) } } });
    await prisma.accommodationBed.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.accommodationRoom.deleteMany({ where: { accommodationId: a.id } });
  }
  counts.accommodation = (
    await prisma.accommodation.deleteMany({ where: { name: DEMO } })
  ).count;

  const certs = await prisma.companyCertificate.findMany({
    where: { certificateNo: DEMO },
    select: { id: true },
  });
  await prisma.expiryIndex.deleteMany({ where: { sourceId: { in: certs.map((c) => c.id) } } });
  counts.certificates = (
    await prisma.companyCertificate.deleteMany({ where: { certificateNo: DEMO } })
  ).count;
  await prisma.certificateType.deleteMany({ where: { key: "DEMO_CERT" } });

  counts.subcontractors = (
    await prisma.subcontractor.deleteMany({ where: { code: DEMO } })
  ).count;

  counts.leave = (await prisma.leaveRequest.deleteMany({ where: { reason: DEMO } })).count;

  const policies = await prisma.medicalInsurancePolicy.findMany({
    where: { policyNumber: DEMO },
    select: { id: true },
  });
  const policyIds = policies.map((p) => p.id);
  if (policyIds.length > 0) {
    await prisma.employeeInsurance.deleteMany({ where: { policyId: { in: policyIds } } });
    await prisma.expiryIndex.deleteMany({ where: { sourceId: { in: policyIds } } });
    counts.policies = (
      await prisma.medicalInsurancePolicy.deleteMany({ where: { id: { in: policyIds } } })
    ).count;
  }
  await prisma.insuranceProvider.deleteMany({ where: { name: "DEMO Insurer" } });

  for (const [table, n] of Object.entries(counts)) {
    if (n > 0) console.log(`  removed ${String(n)} ${table}`);
  }
  console.log("demo data removed.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
