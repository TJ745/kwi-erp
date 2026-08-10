/**
 * Verifies the task overdue rule against a real database.
 * Creates three tasks, checks the classification, and removes them.
 *
 * Run: pnpm tsx scripts/verify-tasks.ts
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

const CLOSED = ["COMPLETED", "CANCELLED"] as const;

async function main() {
  const kwi = await prisma.company.findFirstOrThrow({ where: { code: "KWI" } });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@example.local" } });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const seeds = [
    { no: "ZZZ-T1", title: "Overdue and open", due: yesterday, status: "TODO" as const },
    { no: "ZZZ-T2", title: "Overdue but completed", due: yesterday, status: "COMPLETED" as const },
    { no: "ZZZ-T3", title: "Due tomorrow", due: tomorrow, status: "TODO" as const },
  ];

  for (const seed of seeds) {
    await prisma.task.create({
      data: {
        taskNo: seed.no,
        companyId: kwi.id,
        title: seed.title,
        status: seed.status,
        priority: "MEDIUM",
        createdById: admin.id,
        dueDate: seed.due,
        completedAt: seed.status === "COMPLETED" ? new Date() : null,
      },
    });
  }

  console.log("Overdue rule (dueDate < now AND status not closed)");

  const overdue = await prisma.task.findMany({
    where: {
      taskNo: { startsWith: "ZZZ-T" },
      dueDate: { lt: new Date() },
      status: { notIn: [...CLOSED] },
    },
    select: { taskNo: true },
  });
  const overdueNos = overdue.map((t) => t.taskNo).sort();

  check("open past-due task counts as overdue", overdueNos.includes("ZZZ-T1"));
  // The rule that is easy to get wrong: a completed task is never overdue,
  // however far past its due date.
  check("completed past-due task is NOT overdue", !overdueNos.includes("ZZZ-T2"));
  check("future task is NOT overdue", !overdueNos.includes("ZZZ-T3"));
  check("exactly one overdue task", overdueNos.length === 1, overdueNos.join(", "));

  console.log("\nBusiness code uniqueness");
  try {
    await prisma.task.create({
      data: {
        taskNo: "ZZZ-T1",
        companyId: kwi.id,
        title: "Duplicate number",
        createdById: admin.id,
      },
    });
    check("duplicate task number rejected", false, "was allowed");
  } catch {
    check("duplicate task number rejected", true);
  }

  await prisma.task.deleteMany({ where: { taskNo: { startsWith: "ZZZ-T" } } });
  console.log("\ntemporary tasks removed");

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
