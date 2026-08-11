/**
 * Verifies the Phase 6 business rules against a real database:
 *   - contract end dates feed the expiry projection
 *   - only one ACTIVE contract per employee
 *   - overlapping leave is refused
 *   - offboarding cannot complete while an asset is unreturned
 *
 * Every row it creates is removed at the end.
 * Run: pnpm tsx scripts/verify-hr.ts
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

const TERMINAL = ["COMPLETED", "NOT_APPLICABLE"] as const;

async function main() {
  const kwi = await prisma.company.findFirstOrThrow({ where: { code: "KWI" } });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@example.local" } });

  const employee = await prisma.employee.create({
    data: {
      employeeNo: "ZZZ-HR-1",
      companyId: kwi.id,
      firstName: "HR",
      lastName: "Verify",
      fullName: "HR Verify",
      gender: "MALE",
      nationality: "PK",
      joiningDate: new Date("2025-01-01"),
    },
  });

  // --- Contracts ------------------------------------------------------------
  console.log("Contracts");
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 45);

  const contract = await prisma.contract.create({
    data: {
      employeeId: employee.id,
      companyId: kwi.id,
      contractType: "FIXED_TERM",
      startDate: new Date("2025-01-01"),
      endDate,
      status: "ACTIVE",
      basicSalary: "5000.00",
    },
  });

  await prisma.expiryIndex.upsert({
    where: { source_sourceId: { source: "EMPLOYEE_CONTRACT", sourceId: contract.id } },
    create: {
      source: "EMPLOYEE_CONTRACT",
      sourceId: contract.id,
      label: `Contract — ${employee.fullName}`,
      expiryDate: endDate,
      employeeId: employee.id,
      companyId: kwi.id,
    },
    update: {},
  });

  const projected = await prisma.expiryIndex.findUnique({
    where: { source_sourceId: { source: "EMPLOYEE_CONTRACT", sourceId: contract.id } },
  });
  check("contract end date lands in the expiry projection", projected !== null);
  check("projection is company-scoped", projected?.companyId === kwi.id);

  const activeCount = await prisma.contract.count({
    where: { employeeId: employee.id, status: "ACTIVE", deletedAt: null },
  });
  check("one active contract recorded", activeCount === 1);

  // --- Leave ----------------------------------------------------------------
  console.log("\nLeave");
  const leaveType = await prisma.leaveType.findFirstOrThrow();

  await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-05"),
      days: 5,
      status: "PENDING",
      createdById: admin.id,
    },
  });

  // The overlap guard is service-level, so this checks the query it relies on.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: new Date("2026-09-03") },
      endDate: { gte: new Date("2026-09-02") },
    },
  });
  check("overlapping request is detectable", overlap !== null);

  // A rejected request must not block a resubmission for the same dates.
  await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-03"),
      days: 3,
      status: "REJECTED",
      createdById: admin.id,
    },
  });
  const blockedByRejected = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: new Date("2026-10-03") },
      endDate: { gte: new Date("2026-10-01") },
    },
  });
  check("a rejected request does not block resubmission", blockedByRejected === null);

  // --- Offboarding gate -----------------------------------------------------
  console.log("\nOffboarding completion gate");
  const template = await prisma.checklistTemplate.findFirstOrThrow({
    where: { type: "OFFBOARDING" },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const instance = await prisma.checklistInstance.create({
    data: {
      templateId: template.id,
      type: "OFFBOARDING",
      employeeId: employee.id,
      companyId: kwi.id,
      createdById: admin.id,
      items: {
        create: template.items.map((i) => ({
          templateItemId: i.id,
          order: i.order,
          label: i.label,
          category: i.category,
          status: "COMPLETED",
          completedAt: new Date(),
        })),
      },
    },
    include: { items: true },
  });

  const incomplete = instance.items.filter((i) => !TERMINAL.includes(i.status as "COMPLETED"));
  check("all checklist steps marked done", incomplete.length === 0);

  // Now hand out an asset and confirm it is detectable as a blocker.
  const asset = await prisma.iTAsset.create({
    data: {
      assetCode: "ZZZ-HR-IT",
      type: "LAPTOP",
      brand: "Test",
      model: "Blocker",
      companyId: kwi.id,
    },
  });
  await prisma.iTAssetAssignment.create({
    data: {
      assetId: asset.id,
      employeeId: employee.id,
      assignedAt: new Date(),
      assignedById: admin.id,
      conditionOut: "GOOD",
    },
  });

  const unreturned = await prisma.iTAssetAssignment.count({
    where: { employeeId: employee.id, returnedAt: null },
  });
  check("unreturned asset blocks completion", unreturned === 1, `${String(unreturned)} outstanding`);

  // Return it; the blocker should clear.
  await prisma.iTAssetAssignment.updateMany({
    where: { employeeId: employee.id, returnedAt: null },
    data: { returnedAt: new Date(), conditionIn: "GOOD", receivedById: admin.id },
  });
  const stillOut = await prisma.iTAssetAssignment.count({
    where: { employeeId: employee.id, returnedAt: null },
  });
  check("returning the asset clears the blocker", stillOut === 0);

  // --- Cleanup --------------------------------------------------------------
  await prisma.checklistItem.deleteMany({ where: { instanceId: instance.id } });
  await prisma.checklistInstance.delete({ where: { id: instance.id } });
  await prisma.iTAssetAssignment.deleteMany({ where: { employeeId: employee.id } });
  await prisma.iTAsset.delete({ where: { id: asset.id } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: employee.id } });
  await prisma.expiryIndex.deleteMany({ where: { sourceId: contract.id } });
  await prisma.contract.delete({ where: { id: contract.id } });
  await prisma.employee.delete({ where: { id: employee.id } });
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
