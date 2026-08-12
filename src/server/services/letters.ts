import "server-only";
import type { LetterStatus, LetterType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  extractVariables,
  renderTemplate,
  sanitiseTemplateHtml,
  TEMPLATE_VARIABLES,
  type TemplateVariable,
} from "@/lib/templates";
import { nextLetterNo } from "./counter";

/**
 * Letter templates and generation — brief §37.
 *
 * The generated letter freezes its data: a salary letter must keep saying what
 * it said when it was issued, even after the salary changes. That is what
 * GeneratedLetter.dataSnapshot and renderedHtml are for — the letter is never
 * re-rendered from live data.
 */

export async function listTemplates(ctx: ActorContext) {
  return prisma.letterTemplate.findMany({
    where: { deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      isActive: true,
      version: true,
      companyId: true,
      company: { select: { code: true } },
      _count: { select: { generated: true } },
    },
  });
}

export async function getTemplate(ctx: ActorContext, id: string) {
  const template = await prisma.letterTemplate.findFirst({
    where: { id, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      bodyHtml: true,
      bodyHtmlAr: true,
      variables: true,
      isActive: true,
      version: true,
      companyId: true,
    },
  });
  if (!template) throw new NotFoundError("Template not found.");
  return template;
}

export type TemplateInput = {
  key: string;
  name: string;
  type: LetterType;
  companyId?: string | undefined;
  bodyHtml: string;
  bodyHtmlAr?: string | undefined;
  isActive: boolean;
};

export async function upsertTemplate(
  ctx: ActorContext,
  input: TemplateInput & { id?: string | undefined },
) {
  if (input.companyId && ctx.companyScope !== "ALL" && !ctx.companyScope.includes(input.companyId)) {
    throw new ForbiddenError("Record not found.");
  }

  const clash = await prisma.letterTemplate.findFirst({
    where: { key: input.key, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A template with key "${input.key}" already exists.`);

  // Sanitised on save AND again on render: a body stored before a rule
  // tightened must not become exploitable later.
  const bodyHtml = sanitiseTemplateHtml(input.bodyHtml);
  const bodyHtmlAr = input.bodyHtmlAr ? sanitiseTemplateHtml(input.bodyHtmlAr) : null;

  // Recorded so the editor can list what this template actually uses without
  // re-parsing, and so an unknown placeholder is visible on the template list.
  const used = extractVariables(`${bodyHtml} ${bodyHtmlAr ?? ""}`);
  const variables = {
    known: used.known.map((key) => ({
      key,
      label: TEMPLATE_VARIABLES[key as TemplateVariable],
    })),
    unknown: used.unknown,
  } satisfies Prisma.InputJsonValue;

  const data = {
    key: input.key,
    name: input.name,
    type: input.type,
    companyId: input.companyId ?? null,
    bodyHtml,
    bodyHtmlAr,
    variables,
    isActive: input.isActive,
  };

  if (input.id) {
    const before = await getTemplate(ctx, input.id);
    const updated = await prisma.letterTemplate.update({
      where: { id: input.id },
      // Editing a template bumps its version; already-generated letters keep
      // their frozen copy and are unaffected.
      data: { ...data, version: { increment: 1 } },
      select: { id: true, name: true, key: true, version: true },
    });
    return { template: updated, before: { name: before.name, version: before.version } };
  }

  const created = await prisma.letterTemplate.create({
    data,
    select: { id: true, name: true, key: true, version: true },
  });
  return { template: created, before: null };
}

export async function deleteTemplate(ctx: ActorContext, id: string) {
  const template = await getTemplate(ctx, id);

  // Soft delete only: already-generated letters reference the template row,
  // and their audit trail must keep resolving.
  await prisma.letterTemplate.update({
    where: { id: template.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  return { id: template.id, name: template.name };
}

/** Collects everything a template can reference for one employee. */
export async function buildLetterData(
  ctx: ActorContext,
  employeeId: string,
): Promise<{
  data: Partial<Record<TemplateVariable, string | null>>;
  employee: { id: string; fullName: string; companyId: string };
}> {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      fullNameAr: true,
      nationality: true,
      joiningDate: true,
      lastWorkingDate: true,
      companyId: true,
      company: { select: { name: true, shortName: true, crNumber: true } },
      position: { select: { title: true } },
      department: { select: { name: true } },
      iqama: { select: { iqamaNumber: true } },
      passport: { select: { passportNumber: true } },
      contracts: {
        where: { status: "ACTIVE", deletedAt: null },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          startDate: true,
          endDate: true,
          currency: true,
          // Only selected when permitted — an unauthorised generator cannot
          // produce a letter containing a salary they may not see.
          basicSalary: canSeeSalary,
        },
      },
    },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  const contract = employee.contracts[0];
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      companyId: employee.companyId,
    },
    data: {
      employee_name: employee.fullName,
      employee_name_ar: employee.fullNameAr,
      employee_id: employee.employeeNo,
      employee_nationality: employee.nationality,
      iqama_number: employee.iqama?.iqamaNumber ?? null,
      passport_number: employee.passport?.passportNumber ?? null,
      company_name: employee.company.name,
      company_short_name: employee.company.shortName,
      company_cr: employee.company.crNumber,
      position: employee.position?.title ?? null,
      department: employee.department?.name ?? null,
      joining_date: iso(employee.joiningDate),
      last_working_date: iso(employee.lastWorkingDate),
      salary: canSeeSalary && contract?.basicSalary ? contract.basicSalary.toString() : null,
      currency: contract?.currency ?? "SAR",
      contract_start: iso(contract?.startDate),
      contract_end: iso(contract?.endDate),
      today: new Date().toISOString().slice(0, 10),
    },
  };
}

/**
 * Employees a letter can be generated for. Scope-wide rather than per-company:
 * the operator picks the person first and the company follows from them.
 */
export async function letterRecipients(ctx: ActorContext) {
  return prisma.employee.findMany({
    where: { deletedAt: null, ...companyScopeWhere(ctx) },
    orderBy: { fullName: "asc" },
    take: 1000,
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      company: { select: { code: true } },
    },
  });
}

/** Preview without persisting — lets the operator see missing values first. */
export async function previewLetter(
  ctx: ActorContext,
  input: { templateId: string; employeeId: string },
) {
  const [template, built] = await Promise.all([
    getTemplate(ctx, input.templateId),
    buildLetterData(ctx, input.employeeId),
  ]);

  const rendered = renderTemplate(sanitiseTemplateHtml(template.bodyHtml), built.data);
  const renderedAr = template.bodyHtmlAr
    ? renderTemplate(sanitiseTemplateHtml(template.bodyHtmlAr), built.data)
    : null;

  return {
    templateName: template.name,
    employeeName: built.employee.fullName,
    html: rendered.html,
    htmlAr: renderedAr?.html ?? null,
    missing: rendered.missing,
    unknown: rendered.unknown,
  };
}

export async function generateLetter(
  ctx: ActorContext,
  input: { templateId: string; employeeId: string },
) {
  const [template, built] = await Promise.all([
    getTemplate(ctx, input.templateId),
    buildLetterData(ctx, input.employeeId),
  ]);

  if (!template.isActive) {
    throw new ConflictError("That template is inactive and cannot be used.");
  }

  const rendered = renderTemplate(sanitiseTemplateHtml(template.bodyHtml), built.data);
  const renderedAr = template.bodyHtmlAr
    ? renderTemplate(sanitiseTemplateHtml(template.bodyHtmlAr), built.data)
    : null;

  // Whether a salary actually made it into the body — not whether the template
  // mentions one. A {{salary}} that rendered as an unresolved placeholder
  // leaks nothing and must not lock the letter away from the people who need it.
  const salaryRendered =
    Boolean(built.data.salary) &&
    !rendered.missing.includes("salary") &&
    (rendered.html.includes(built.data.salary ?? " ") ||
      (renderedAr?.html.includes(built.data.salary ?? " ") ?? false));

  return prisma.$transaction(async (tx) => {
    const letterNo = await nextLetterNo(tx);

    // The rendered HTML and the data are both stored. The letter is never
    // re-rendered from live data, so it keeps saying what it said on the day.
    const letter = await tx.generatedLetter.create({
      data: {
        letterNo,
        templateId: template.id,
        companyId: built.employee.companyId,
        entityType: "EMPLOYEE",
        entityId: built.employee.id,
        employeeId: built.employee.id,
        renderedHtml: renderedAr
          ? `${rendered.html}<hr /><div dir="rtl" lang="ar">${renderedAr.html}</div>`
          : rendered.html,
        dataSnapshot: {
          ...built.data,
          letter_no: letterNo,
          _templateVersion: template.version,
          _generatedBy: ctx.userId,
        } as Prisma.InputJsonValue,
        containsSalary: salaryRendered,
        generatedById: ctx.userId,
      },
      select: { id: true, letterNo: true, companyId: true, containsSalary: true },
    });

    return {
      ...letter,
      templateName: template.name,
      employeeName: built.employee.fullName,
      missing: rendered.missing,
    };
  });
}

export async function listGeneratedLetters(
  ctx: ActorContext,
  filters: { employeeId?: string | undefined } = {},
) {
  return prisma.generatedLetter.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    orderBy: { generatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      letterNo: true,
      status: true,
      generatedAt: true,
      // The list carries no bodies, so a restricted letter is still listed —
      // its metadata is not the secret. The flag lets the UI say why it cannot
      // be opened rather than 404ing on click.
      containsSalary: true,
      template: { select: { name: true, type: true } },
      employee: { select: { id: true, fullName: true, employeeNo: true } },
      company: { select: { code: true } },
    },
  });
}

/** GENERATED -> ISSUED once handed over, or CANCELLED if superseded. */
export async function setLetterStatus(
  ctx: ActorContext,
  input: { id: string; status: LetterStatus },
) {
  const letter = await prisma.generatedLetter.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, letterNo: true, status: true, companyId: true },
  });
  if (!letter) throw new NotFoundError("Letter not found.");

  await prisma.generatedLetter.update({
    where: { id: letter.id },
    data: { status: input.status },
  });

  return { ...letter, before: letter.status, after: input.status };
}

/**
 * Reads one letter, including its body.
 *
 * A letter is a copy of employee data in a different shape, so the gates that
 * apply to the source apply here: without employees.salary.view, a letter whose
 * body carries a salary is not readable. Otherwise generating a salary
 * certificate would be a way to hand that figure to anyone with letters.view —
 * which VIEWER has by default.
 */
export async function getGeneratedLetter(ctx: ActorContext, id: string) {
  const letter = await prisma.generatedLetter.findFirst({
    where: {
      id,
      ...companyScopeWhere(ctx),
      // Applied in the query, not after: a filtered-out row must be
      // indistinguishable from one that does not exist.
      ...(ctx.permissions.has("employees.salary.view") ? {} : { containsSalary: false }),
    },
    select: {
      id: true,
      letterNo: true,
      renderedHtml: true,
      // dataSnapshot is deliberately not selected: the rendered body is what
      // the page shows, and the snapshot would hand the raw salary to the
      // client for nothing.
      containsSalary: true,
      status: true,
      generatedAt: true,
      template: { select: { name: true, type: true } },
      employee: { select: { id: true, fullName: true, employeeNo: true } },
      company: { select: { code: true, name: true, addressLine: true, city: true } },
    },
  });
  if (!letter) throw new NotFoundError("Letter not found.");
  return letter;
}
