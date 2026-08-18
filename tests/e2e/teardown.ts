import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { E2E_PREFIX } from "./roles";

/**
 * Removes everything the suite created.
 *
 * Employees cannot be deleted through the application by design (MODULES.md
 * §7 — status transitions only), so this reaches past the service layer. That
 * is legitimate for a test fixture and nowhere else: leaving a fake employee
 * behind on every run would slowly fill a shared development database with
 * records that look real.
 */
export default async function globalTeardown(): Promise<void> {
  for (const file of [".env", ".env.local"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("e2e teardown: no database URL; leaving fixtures in place.");
    return;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("e2e teardown: refusing to run against production.");
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  const like = { startsWith: E2E_PREFIX };

  try {
    // Order matters: children before the rows they reference.
    const employees = await prisma.employee.findMany({
      where: { firstName: like },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    if (employeeIds.length > 0) {
      await prisma.bedAssignment.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.iTAssetAssignment.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      await prisma.checklistItem.deleteMany({
        where: { instance: { employeeId: { in: employeeIds } } },
      });
      await prisma.checklistInstance.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      await prisma.emergencyContact.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      await prisma.employeeBankDetail.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      await prisma.expiryIndex.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.task.deleteMany({ where: { entityId: { in: employeeIds } } });
      await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    }

    const accounts = await prisma.pettyCashAccount.findMany({
      where: { name: like },
      select: { id: true },
    });
    if (accounts.length > 0) {
      const ids = accounts.map((a) => a.id);
      await prisma.pettyCashTransaction.deleteMany({ where: { accountId: { in: ids } } });
      await prisma.pettyCashAccount.deleteMany({ where: { id: { in: ids } } });
    }

    await prisma.iTAsset.deleteMany({ where: { brand: like } });
    await prisma.notification.deleteMany({ where: { title: { contains: E2E_PREFIX } } });

    console.log(
      `e2e teardown: removed ${String(employeeIds.length)} employee(s), ` +
        `${String(accounts.length)} petty cash account(s), and related fixtures.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
