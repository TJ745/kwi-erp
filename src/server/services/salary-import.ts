import "server-only";
import { PAY_FIELDS, PAY_PARTS, PAY_SELECT, payOf, type PayPart } from "@/lib/salary";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { recordAudit } from "@/server/audit/log";
import {
  summariseSalaryRows,
  validateSalaryRows,
  type SalaryPreview,
  type SalaryReferences,
  type SalaryRow,
} from "@/lib/salary-import";

/**
 * Bulk salary update. Like the employee import: preview and commit both
 * re-validate the whole file against the live database, and the commit writes
 * every changed row or none.
 */

async function inScopeEmployees(ctx: ActorContext) {
  return prisma.employee.findMany({
    where: { ...companyScopeWhere(ctx), deletedAt: null },
    orderBy: [{ company: { code: "asc" } }, { employeeNo: "asc" }],
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      companyId: true,
      company: { select: { code: true } },
      ...PAY_SELECT,
    },
  });
}

const num = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()));

export async function salaryTemplateRows(ctx: ActorContext) {
  const employees = await inScopeEmployees(ctx);
  return employees.map((e) => ({
    employeeNo: e.employeeNo,
    name: e.fullName,
    company: e.company.code,
    ...(Object.fromEntries(PAY_PARTS.map((p) => [p, num(e[PAY_FIELDS[p]])])) as Record<
      PayPart,
      number | null
    >),
  }));
}

async function references(ctx: ActorContext): Promise<SalaryReferences> {
  const employees = await inScopeEmployees(ctx);
  return {
    employees: new Map(
      employees.map((e) => [
        e.employeeNo.toUpperCase(),
        {
          id: e.id,
          name: e.fullName,
          salary: payOf(e),
        },
      ]),
    ),
  };
}

export async function previewSalaryImport(
  ctx: ActorContext,
  rows: readonly SalaryRow[],
): Promise<SalaryPreview> {
  return summariseSalaryRows(validateSalaryRows(rows, await references(ctx)).results);
}

export async function commitSalaryImport(
  ctx: ActorContext,
  rows: readonly SalaryRow[],
): Promise<{ ok: true; updated: number } | { ok: false; preview: SalaryPreview }> {
  const { results, valid } = validateSalaryRows(rows, await references(ctx));
  const preview = summariseSalaryRows(results);
  if (preview.errorCount > 0) return { ok: false, preview };

  const changed = valid.filter((v) => v.changed);
  if (changed.length === 0) return { ok: true, updated: 0 };

  await prisma.$transaction(
    async (tx) => {
      for (const row of changed) {
        await tx.employee.update({
          where: { id: row.employeeId },
          data: Object.fromEntries(PAY_PARTS.map((p) => [PAY_FIELDS[p], row.values[p]])),
        });
      }
      // Amounts stay out of the audit log: audit.view does not imply
      // employees.salary.view. Who, when and which employees is the record.
      await recordAudit(
        ctx,
        {
          action: "UPDATE",
          entityType: "EMPLOYEE",
          entityId: "SALARY_IMPORT",
          summary: `Updated salaries of ${String(changed.length)} employee(s) from a spreadsheet`,
          after: { count: changed.length, employeeIds: changed.map((r) => r.employeeId) },
        },
        tx,
      );
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { ok: true, updated: changed.length };
}
