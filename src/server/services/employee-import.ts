import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere } from "@/server/auth/guards";
import { recordAudit } from "@/server/audit/log";
import {
  validateImportRows,
  type ImportPreview,
  type ImportReferences,
  type ImportRow,
  type ValidatedRow,
} from "@/lib/employee-import";

/**
 * Bulk employee import — the database side of `lib/employee-import`.
 *
 * Two entry points that share one validation: `preview` reports what would
 * happen, `commit` does it. Both re-validate the full file against the live
 * database — the preview is not a reservation, so a number taken between the
 * two calls is caught, not written twice.
 *
 * All-or-nothing on purpose. A partial import of a company's staff list
 * leaves the person running it working out which 40 of 200 went in; a
 * refused import with a list of what to fix leaves them with a sheet to
 * correct and one button to press again.
 */

/** Everything the validator matches against, in the actor's scope. */
async function loadReferences(ctx: ActorContext): Promise<ImportReferences> {
  const [companies, departments, positions, employees] = await Promise.all([
    prisma.company.findMany({
      where: ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } },
      select: { id: true, code: true },
    }),
    prisma.department.findMany({
      where: { status: "ACTIVE", ...companyScopeWhere(ctx) },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.position.findMany({
      where: { status: "ACTIVE", ...optionalCompanyScopeWhere(ctx) },
      select: { id: true, title: true, companyId: true },
    }),
    // Numbers and emails are unique across the whole table, archived rows
    // included, so this list is deliberately NOT company-scoped: a clash with
    // an out-of-scope record must still be refused. Only the number and the
    // email leave this query, and only as "taken".
    prisma.employee.findMany({
      select: { id: true, employeeNo: true, workEmail: true, companyId: true, deletedAt: true },
    }),
  ]);

  return {
    companies,
    departments,
    positions,
    existingEmployeeNos: new Set(employees.map((e) => e.employeeNo.toUpperCase())),
    existingWorkEmails: new Set(
      employees.flatMap((e) => (e.workEmail ? [e.workEmail.toLowerCase()] : [])),
    ),
    // A manager must be a live record in a company the actor can see.
    managers: employees
      .filter((e) => !e.deletedAt && companies.some((c) => c.id === e.companyId))
      .map((e) => ({ id: e.id, employeeNo: e.employeeNo, companyId: e.companyId })),
  };
}

/** The lists the template's Reference sheet prints, in the actor's scope. */
export async function importTemplateReferences(ctx: ActorContext) {
  const [companies, departments, positions] = await Promise.all([
    prisma.company.findMany({
      where: ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
    prisma.department.findMany({
      where: { status: "ACTIVE", ...companyScopeWhere(ctx) },
      orderBy: { name: "asc" },
      select: { name: true, company: { select: { code: true } } },
    }),
    prisma.position.findMany({
      where: { status: "ACTIVE", ...optionalCompanyScopeWhere(ctx) },
      orderBy: { title: "asc" },
      select: { title: true, company: { select: { code: true } } },
    }),
  ]);

  return {
    companies,
    departments: departments.map((d) => ({ name: d.name, companyCode: d.company.code })),
    positions: positions.map((p) => ({ title: p.title, companyCode: p.company?.code ?? null })),
  };
}

function summarise(results: ReturnType<typeof validateImportRows>["results"]): ImportPreview {
  const errorCount = results.filter((r) => r.issues.length > 0).length;
  return { rows: results, readyCount: results.length - errorCount, errorCount };
}

export async function previewEmployeeImport(
  ctx: ActorContext,
  rows: readonly ImportRow[],
): Promise<ImportPreview> {
  const refs = await loadReferences(ctx);
  return summarise(validateImportRows(rows, refs).results);
}

const fullNameOf = (first: string, last: string) => `${first} ${last}`.replace(/\s+/g, " ").trim();

/**
 * Writes every row, or none. A file with errors is returned as its preview
 * rather than thrown: the rows are the answer, not an exception.
 */
export async function commitEmployeeImport(
  ctx: ActorContext,
  rows: readonly ImportRow[],
): Promise<{ ok: true; created: number } | { ok: false; preview: ImportPreview }> {
  const refs = await loadReferences(ctx);
  const { results, valid } = validateImportRows(rows, refs);
  const preview = summarise(results);

  if (preview.errorCount > 0 || valid.length !== rows.length) return { ok: false, preview };

  await prisma.$transaction(
    async (tx) => {
      // One statement for the people, then the in-file reporting lines once
      // every id exists. Managers pointing at existing employees are known
      // up front and go in with the row.
      await tx.employee.createMany({
        data: valid.map((row) => toCreateData(row)),
      });

      const created = await tx.employee.findMany({
        where: { employeeNo: { in: valid.map((row) => row.input.employeeNo) } },
        select: { id: true, employeeNo: true, fullName: true, companyId: true },
      });
      const idByNo = new Map(created.map((e) => [e.employeeNo, e.id]));

      for (const row of valid) {
        if (row.manager && "rowEmployeeNo" in row.manager) {
          const managerId = idByNo.get(row.manager.rowEmployeeNo);
          const id = idByNo.get(row.input.employeeNo);
          if (managerId && id) {
            await tx.employee.update({ where: { id }, data: { managerId } });
          }
        }
      }

      // One audit entry per person, so each record's history starts with its
      // creation like a form-created one does; plus one for the import as a
      // whole, which is what the question "who loaded these?" is asking.
      for (const e of created) {
        await recordAudit(
          ctx,
          {
            action: "CREATE",
            entityType: "EMPLOYEE",
            entityId: e.id,
            companyId: e.companyId,
            summary: `Created employee ${e.employeeNo} — ${e.fullName} (bulk import)`,
            after: { employeeNo: e.employeeNo, fullName: e.fullName },
          },
          tx,
        );
      }
      await recordAudit(
        ctx,
        {
          action: "CREATE",
          entityType: "EMPLOYEE",
          entityId: "IMPORT",
          summary: `Imported ${String(created.length)} employees from a spreadsheet`,
          after: {
            count: created.length,
            companies: [...new Set(created.map((e) => e.companyId))],
            employeeNos: created.map((e) => e.employeeNo),
          },
        },
        tx,
      );
    },
    // Hundreds of sequential statements over a serverless connection; the
    // default 5 s interactive-transaction budget is not enough.
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { ok: true, created: valid.length };
}

function toCreateData(row: ValidatedRow) {
  const i = row.input;
  return {
    employeeNo: i.employeeNo,
    companyId: i.companyId,
    departmentId: i.departmentId ?? null,
    positionId: i.positionId ?? null,
    managerId: row.manager && "existingId" in row.manager ? row.manager.existingId : null,
    firstName: i.firstName,
    middleName: i.middleName ?? null,
    lastName: i.lastName,
    familyName: i.familyName ?? null,
    fullName: fullNameOf(i.firstName, i.lastName),
    fullNameAr: i.fullNameAr ?? null,
    gender: i.gender,
    dateOfBirth: i.dateOfBirth ?? null,
    nationality: i.nationality,
    maritalStatus: i.maritalStatus ?? null,
    status: i.status,
    employmentType: i.employmentType,
    joiningDate: i.joiningDate,
    lastWorkingDate: i.lastWorkingDate ?? null,
    mobile: i.mobile ?? null,
    workEmail: i.workEmail ?? null,
    personalEmail: i.personalEmail ?? null,
    notes: i.notes ?? null,
  };
}
