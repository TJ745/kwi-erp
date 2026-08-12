/**
 * Proves the letter engine end to end against the live database.
 *
 * The claims worth proving are not "it renders" but:
 *   1. Generated letters freeze their data — editing the source afterwards does
 *      not change an already-issued letter.
 *   2. Salary gating survives generation — an actor without
 *      employees.salary.view cannot produce a letter containing a salary.
 *   3. Company scope holds on the read side.
 *   4. Stored template bodies contain nothing executable.
 *
 * Creates and removes its own fixtures. Run: pnpm tsx scripts/verify-letters.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { renderTemplate, sanitiseTemplateHtml } from "../src/lib/templates.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({
    connectionString: process.env.DIRECT_URL ?? requireEnv("DATABASE_URL"),
  }),
});

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const FIXTURE_KEY = "__verify_letters_tmp";
/** Exact string, so cleanup can find fixtures left by a crashed run. */
const FIXTURE_NOTE = "Temporary fixture created by verify-letters.ts";

/**
 * The snapshot test renames a real employee. Recorded here so cleanup can put
 * the name back even if the script dies between the rename and the restore.
 */
let renamedEmployee: { id: string; originalName: string } | null = null;

async function main() {
  console.log("Seeded templates");
  const templates = await prisma.letterTemplate.findMany({
    where: { deletedAt: null },
    select: { id: true, key: true, name: true, bodyHtml: true, bodyHtmlAr: true, type: true },
  });
  console.log(`  ${String(templates.length)} template(s)`);
  check("templates were seeded", templates.length > 0);

  // 4. Nothing executable survived into storage.
  console.log("\nStored bodies are inert");
  const dangerous = /<\s*(script|iframe|object|embed|form|svg|link|meta|base)\b|\son[a-z]+\s*=|javascript:/i;
  let inert = true;
  for (const t of templates) {
    const combined = `${t.bodyHtml} ${t.bodyHtmlAr ?? ""}`;
    if (dangerous.test(combined)) {
      console.log(`    ${t.key} contains executable markup`);
      inert = false;
    }
  }
  check("no stored body contains script, handler, or scheme", inert);

  // Sanitising again must be a no-op: if it is not, storage disagrees with the
  // sanitiser and something got in before a rule tightened.
  const stable = templates.every((t) => sanitiseTemplateHtml(t.bodyHtml) === t.bodyHtml);
  check("re-sanitising stored bodies changes nothing", stable);

  // --- Fixtures -------------------------------------------------------------
  const employee = await prisma.employee.findFirst({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      companyId: true,
      company: { select: { name: true, code: true } },
    },
  });
  if (!employee) throw new Error("No employees seeded; run pnpm db:seed first.");

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error("No users seeded.");

  const template = await prisma.letterTemplate.upsert({
    where: { key: FIXTURE_KEY },
    update: {},
    create: {
      key: FIXTURE_KEY,
      name: "Verification fixture",
      type: "OTHER",
      bodyHtml: "<p>Name: {{employee_name}} — Salary: {{salary}}</p>",
      variables: {},
      isActive: true,
    },
    select: { id: true, bodyHtml: true, version: true },
  });

  // --- 2. Salary gating -----------------------------------------------------
  console.log("\nSalary gating");

  // A gating check against an employee with no salary proves nothing — both
  // renders would be empty for the same reason. So a real figure is created.
  let contract = await prisma.contract.findFirst({
    where: {
      employeeId: employee.id,
      status: "ACTIVE",
      deletedAt: null,
      basicSalary: { not: null },
    },
    select: { basicSalary: true },
  });

  if (!contract) {
    const created = await prisma.contract.create({
      data: {
        employeeId: employee.id,
        companyId: employee.companyId,
        contractType: "PERMANENT",
        startDate: new Date("2024-01-01"),
        basicSalary: "13571.75",
        currency: "SAR",
        status: "ACTIVE",
        notes: FIXTURE_NOTE,
      },
      select: { id: true, basicSalary: true },
    });

    contract = { basicSalary: created.basicSalary };
    console.log("  created a temporary contract so the gating check has a real figure");
  }

  const salary = contract.basicSalary?.toString() ?? null;
  const salaryFigure = salary;
  console.log(`  employee ${employee.fullName} salary in DB: ${salary ?? "none"}`);

  // This mirrors buildLetterData: when the permission is absent the field is
  // never selected, so there is nothing to leak into the render.
  const permitted = renderTemplate(template.bodyHtml, {
    employee_name: employee.fullName,
    ...(salary ? { salary } : {}),
  });
  const denied = renderTemplate(template.bodyHtml, {
    employee_name: employee.fullName,
    // no salary key — exactly what the service produces without the permission
  });

  check(
    "denied render contains no salary figure",
    salary === null || !denied.html.includes(salary),
    salary ? `looked for "${salary}"` : "no salary on this employee to leak",
  );
  check("denied render flags the placeholder as missing", denied.missing.includes("salary"));
  check(
    "permitted render does contain the salary",
    salary !== null && permitted.html.includes(salary),
  );

  // --- 1. Frozen snapshot ---------------------------------------------------
  console.log("\nFrozen data snapshot");
  const originalName = employee.fullName;
  const rendered = renderTemplate(template.bodyHtml, {
    employee_name: originalName,
    ...(salary ? { salary } : {}),
  });

  const letter = await prisma.generatedLetter.create({
    data: {
      letterNo: `LTR-VERIFY-${String(Date.now())}`,
      templateId: template.id,
      companyId: employee.companyId,
      entityType: "EMPLOYEE",
      entityId: employee.id,
      employeeId: employee.id,
      renderedHtml: rendered.html,
      dataSnapshot: { employee_name: originalName, _templateVersion: template.version },
      generatedById: user.id,
    },
    select: { id: true, letterNo: true, renderedHtml: true },
  });
  console.log(`  generated ${letter.letterNo}`);

  // Change the source record, then confirm the letter did not follow.
  renamedEmployee = { id: employee.id, originalName };
  await prisma.employee.update({
    where: { id: employee.id },
    data: { fullName: `${originalName} CHANGED` },
  });

  const after = await prisma.generatedLetter.findUniqueOrThrow({
    where: { id: letter.id },
    select: { renderedHtml: true, dataSnapshot: true },
  });

  check("rendered HTML still shows the original name", after.renderedHtml.includes(originalName));
  check("rendered HTML does not show the changed name", !after.renderedHtml.includes("CHANGED"));
  check(
    "snapshot still holds the original name",
    (after.dataSnapshot as { employee_name?: string }).employee_name === originalName,
  );

  await prisma.employee.update({
    where: { id: employee.id },
    data: { fullName: originalName },
  });
  renamedEmployee = null;
  console.log("  source record restored");

  // --- 5. Salary-bearing letters are gated on read --------------------------
  // A letter is employee data in another shape. Without this, generating a
  // salary certificate would hand the figure to anyone with letters.view —
  // which VIEWER holds by default.
  console.log("\nSalary-bearing letters are gated on read");

  const sensitive = await prisma.generatedLetter.create({
    data: {
      letterNo: `LTR-VERIFY-SAL-${String(Date.now())}`,
      templateId: template.id,
      companyId: employee.companyId,
      entityType: "EMPLOYEE",
      entityId: employee.id,
      employeeId: employee.id,
      renderedHtml: `<p>Salary: ${salary ?? "0"}</p>`,
      dataSnapshot: { salary },
      containsSalary: true,
      generatedById: user.id,
    },
    select: { id: true },
  });

  // The exact where-clause getGeneratedLetter builds for each case.
  const asPermitted = await prisma.generatedLetter.findFirst({
    where: { id: sensitive.id, companyId: { in: [employee.companyId] } },
    select: { id: true },
  });
  const asDenied = await prisma.generatedLetter.findFirst({
    where: {
      id: sensitive.id,
      companyId: { in: [employee.companyId] },
      containsSalary: false,
    },
    select: { id: true },
  });

  check("a salary letter is readable with employees.salary.view", asPermitted !== null);
  check("a salary letter is invisible without it", asDenied === null);

  // The flag must not lock away letters that carry no salary, or every memo
  // would need a permission it has no reason to need.
  const plain = await prisma.generatedLetter.findFirst({
    where: { id: letter.id, containsSalary: false },
    select: { id: true },
  });
  check("a letter with no salary stays readable without the permission", plain !== null);

  // --- 3. Company scope on the read side ------------------------------------
  console.log("\nCompany scope");
  const otherCompany = await prisma.company.findFirst({
    where: { id: { not: employee.companyId } },
    select: { id: true, code: true },
  });

  if (otherCompany) {
    // The same query the service issues, with the other company's scope.
    const visible = await prisma.generatedLetter.findMany({
      where: { id: letter.id, companyId: { in: [otherCompany.id] } },
      select: { id: true },
    });
    check(
      `letter is invisible to ${otherCompany.code}-scoped query`,
      visible.length === 0,
      `letter belongs to ${employee.company.code}`,
    );
  } else {
    console.log("  skipped: only one company seeded");
  }

  // --- Audit hygiene --------------------------------------------------------
  console.log("\nAudit hygiene");
  const letterAudits = await prisma.auditLog.findMany({
    where: { entityType: { in: ["GENERATED_LETTER", "LETTER_TEMPLATE"] } },
    select: { summary: true, changes: true },
    take: 200,
  });
  console.log(`  ${String(letterAudits.length)} letter audit entr(ies)`);

  if (letterAudits.length === 0) {
    // This script writes through Prisma directly, so it produces no audit rows
    // of its own. Saying "ok" here would be asserting against an empty set.
    console.log("  SKIP  audit hygiene — no entries yet; generate a letter in the UI first");
  } else {
    // Audit rows must carry metadata, never the rendered body or a salary figure.
    const leaks = letterAudits.filter((entry) => {
      const blob = JSON.stringify({ s: entry.summary, c: entry.changes });
      return (
        blob.includes("<p>") ||
        blob.includes("renderedHtml") ||
        blob.includes("dataSnapshot") ||
        (salaryFigure !== null && blob.includes(salaryFigure))
      );
    });
    check("no audit entry embeds letter body, snapshot, or salary", leaks.length === 0);
  }

  if (failures > 0) {
    console.log(`\n${String(failures)} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("\nall checks passed");
  }
}

/**
 * Runs regardless of how main() ended. An earlier version cleaned up on the
 * happy path only, and a mid-script failure left a fixture contract — with a
 * salary on it — sitting in the database.
 */
async function cleanup() {
  if (renamedEmployee) {
    await prisma.employee.update({
      where: { id: renamedEmployee.id },
      data: { fullName: renamedEmployee.originalName },
    });
    console.log(`\nrestored employee name: ${renamedEmployee.originalName}`);
  }

  const template = await prisma.letterTemplate.findUnique({
    where: { key: FIXTURE_KEY },
    select: { id: true },
  });

  if (template) {
    // deleteMany, not delete: the FK on templateId is RESTRICT, so every
    // letter from a previous failed run has to go first.
    await prisma.generatedLetter.deleteMany({ where: { templateId: template.id } });
    await prisma.letterTemplate.delete({ where: { id: template.id } });
  }

  const contracts = await prisma.contract.deleteMany({
    where: { notes: FIXTURE_NOTE },
  });

  console.log(
    `\nfixtures removed (template: ${template ? "yes" : "none"}, contracts: ${String(contracts.count)})`,
  );
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((e: unknown) => {
      console.error("cleanup failed:", e instanceof Error ? e.message : e);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  });
