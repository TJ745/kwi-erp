import "server-only";
import { PAY_FIELDS, PAY_PARTS, PAY_SELECT, payOf, sumAmounts, type Pay } from "@/lib/salary";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import { incrementOf, sumBreakdowns, total, type Breakdown } from "@/lib/increments";
import type {
  EmployeeSalaryInput,
  IncrementListInput,
  SaveListLinesInput,
} from "@/lib/schemas/increments";

/**
 * Increment lists: a printable document of current, demanded and proposed
 * salary per employee. Lists never change anyone's salary.
 *
 * Every figure here is salary, so reading needs employees.salary.view on top
 * of the page permission, and lines are limited to employees in the actor's
 * company scope.
 */

function requireSalaryView(ctx: ActorContext) {
  if (!ctx.permissions.has("employees.salary.view")) {
    throw new ForbiddenError("Viewing salary figures needs the “View salary data” permission.");
  }
}

const inScopeEmployee = (ctx: ActorContext) => ({ ...companyScopeWhere(ctx), deletedAt: null });

const s = (d: { toString(): string }) => d.toString();

type LineRow = {
  curBasic: { toString(): string };
  curTransport: { toString(): string };
  curHousing: { toString(): string };
  curOther: { toString(): string };
  demBasic: { toString(): string };
  demTransport: { toString(): string };
  demHousing: { toString(): string };
  demOther: { toString(): string };
  propBasic: { toString(): string };
  propTransport: { toString(): string };
  propHousing: { toString(): string };
  propOther: { toString(): string };
};

function breakdowns(l: LineRow) {
  const current: Breakdown = {
    basic: s(l.curBasic),
    transport: s(l.curTransport),
    housing: s(l.curHousing),
    other: s(l.curOther),
  };
  const demanded: Breakdown = {
    basic: s(l.demBasic),
    transport: s(l.demTransport),
    housing: s(l.demHousing),
    other: s(l.demOther),
  };
  const proposed: Breakdown = {
    basic: s(l.propBasic),
    transport: s(l.propTransport),
    housing: s(l.propHousing),
    other: s(l.propOther),
  };
  return { current, demanded, proposed };
}

const FIGURES = {
  curBasic: true,
  curTransport: true,
  curHousing: true,
  curOther: true,
  demBasic: true,
  demTransport: true,
  demHousing: true,
  demOther: true,
  propBasic: true,
  propTransport: true,
  propHousing: true,
  propOther: true,
} as const;

// --- Lists --------------------------------------------------------------------

export async function listIncrementLists(ctx: ActorContext) {
  requireSalaryView(ctx);
  const lists = await prisma.incrementList.findMany({
    orderBy: [{ listDate: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      title: true,
      listDate: true,
      notes: true,
      lines: { where: { employee: inScopeEmployee(ctx) }, select: FIGURES },
    },
  });

  return lists.map((list) => {
    const rows = list.lines.map(breakdowns);
    return {
      id: list.id,
      title: list.title,
      listDate: list.listDate,
      notes: list.notes,
      employees: rows.length,
      currentTotal: total(sumBreakdowns(rows.map((r) => r.current))),
      demandedTotal: total(sumBreakdowns(rows.map((r) => r.demanded))),
      proposedTotal: total(sumBreakdowns(rows.map((r) => r.proposed))),
    };
  });
}

export async function getIncrementList(ctx: ActorContext, id: string) {
  requireSalaryView(ctx);
  const list = await prisma.incrementList.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      listDate: true,
      notes: true,
      lines: {
        where: { employee: inScopeEmployee(ctx) },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          ...FIGURES,
          employee: {
            select: {
              id: true,
              employeeNo: true,
              fullName: true,
              company: { select: { code: true } },
              position: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (!list) throw new NotFoundError("Increment list not found.");

  const lines = list.lines.map((l) => {
    const b = breakdowns(l);
    return {
      id: l.id,
      employeeId: l.employee.id,
      employeeNo: l.employee.employeeNo,
      name: l.employee.fullName,
      sponsor: l.employee.company.code,
      position: l.employee.position?.title ?? "",
      ...b,
      demandedIncrement: incrementOf(b.current, b.demanded),
      proposedIncrement: incrementOf(b.current, b.proposed),
    };
  });

  return {
    id: list.id,
    title: list.title,
    listDate: list.listDate,
    notes: list.notes,
    lines,
    totals: {
      current: sumBreakdowns(lines.map((l) => l.current)),
      demanded: sumBreakdowns(lines.map((l) => l.demanded)),
      proposed: sumBreakdowns(lines.map((l) => l.proposed)),
    },
  };
}

export async function createIncrementList(ctx: ActorContext, input: IncrementListInput) {
  requireSalaryView(ctx);
  return prisma.incrementList.create({
    data: {
      title: input.title,
      listDate: input.listDate,
      notes: input.notes ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, title: true },
  });
}

export async function updateIncrementList(
  ctx: ActorContext,
  input: IncrementListInput & { id: string },
) {
  requireSalaryView(ctx);
  const before = await prisma.incrementList.findUnique({
    where: { id: input.id },
    select: { id: true, title: true, listDate: true },
  });
  if (!before) throw new NotFoundError("Increment list not found.");
  const after = await prisma.incrementList.update({
    where: { id: input.id },
    data: { title: input.title, listDate: input.listDate, notes: input.notes ?? null },
    select: { id: true, title: true, listDate: true },
  });
  return { before, after };
}

export async function deleteIncrementList(ctx: ActorContext, id: string) {
  requireSalaryView(ctx);
  const list = await prisma.incrementList.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      lines: { select: { employee: { select: { companyId: true } } } },
    },
  });
  if (!list) throw new NotFoundError("Increment list not found.");
  // A list may hold employees of companies this actor cannot see; deleting it
  // would delete their lines too, so only someone who can see them all may.
  if (ctx.companyScope !== "ALL") {
    const scope = ctx.companyScope;
    if (list.lines.some((l) => !scope.includes(l.employee.companyId))) {
      throw new ForbiddenError("This list includes employees of companies you cannot access.");
    }
  }
  await prisma.incrementList.delete({ where: { id } });
  return { id: list.id, title: list.title };
}

// --- Lines --------------------------------------------------------------------

/** Employees that can still be added: in scope, not archived, not already on it. */
export async function employeesToAdd(ctx: ActorContext, listId: string) {
  requireSalaryView(ctx);
  const onList = await prisma.incrementListLine.findMany({
    where: { listId },
    select: { employeeId: true },
  });
  const employees = await prisma.employee.findMany({
    where: { ...inScopeEmployee(ctx), id: { notIn: onList.map((l) => l.employeeId) } },
    orderBy: [{ company: { code: "asc" } }, { employeeNo: "asc" }],
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      status: true,
      basicSalary: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
    },
  });
  return employees.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    name: e.fullName,
    company: e.company.code,
    position: e.position?.title ?? "",
    status: e.status,
    hasSalary: e.basicSalary !== null,
  }));
}

export async function addEmployeesToList(
  ctx: ActorContext,
  input: { listId: string; employeeIds: string[] },
) {
  requireSalaryView(ctx);
  const list = await prisma.incrementList.findUnique({
    where: { id: input.listId },
    select: { id: true, title: true, lines: { select: { employeeId: true, sortOrder: true } } },
  });
  if (!list) throw new NotFoundError("Increment list not found.");

  const already = new Set(list.lines.map((l) => l.employeeId));
  const ids = [...new Set(input.employeeIds)].filter((id) => !already.has(id));
  const employees = await prisma.employee.findMany({
    where: { id: { in: ids }, ...inScopeEmployee(ctx) },
    orderBy: { employeeNo: "asc" },
    select: {
      id: true,
      ...PAY_SELECT,
    },
  });
  if (employees.length !== ids.length) {
    throw new NotFoundError("One or more employees were not found.");
  }

  let order = list.lines.reduce((max, l) => Math.max(max, l.sortOrder), 0);
  const zero = "0";
  await prisma.incrementListLine.createMany({
    // Demanded and proposed start equal to current: an untouched column means
    // "no change", and the increment shows as zero.
    data: employees.map((e) => {
      const basic = e.basicSalary?.toString() ?? zero;
      const transport = e.transportAllowance?.toString() ?? zero;
      const housing = e.housingAllowance?.toString() ?? zero;
      // The list has one column for mobile, food and other allowances.
      const other = sumAmounts([
        e.mobileAllowance?.toString(),
        e.foodAllowance?.toString(),
        e.otherAllowance?.toString(),
      ]);
      order += 1;
      return {
        listId: list.id,
        employeeId: e.id,
        sortOrder: order,
        curBasic: basic,
        curTransport: transport,
        curHousing: housing,
        curOther: other,
        demBasic: basic,
        demTransport: transport,
        demHousing: housing,
        demOther: other,
        propBasic: basic,
        propTransport: transport,
        propHousing: housing,
        propOther: other,
      };
    }),
  });

  return {
    listId: list.id,
    title: list.title,
    added: employees.length,
    withoutSalary: employees.filter((e) => e.basicSalary === null).length,
  };
}

export async function saveListLines(ctx: ActorContext, input: SaveListLinesInput) {
  requireSalaryView(ctx);
  const list = await prisma.incrementList.findUnique({
    where: { id: input.listId },
    select: { id: true, title: true },
  });
  if (!list) throw new NotFoundError("Increment list not found.");

  const editable = await prisma.incrementListLine.findMany({
    where: {
      listId: list.id,
      id: { in: input.lines.map((l) => l.id) },
      employee: inScopeEmployee(ctx),
    },
    select: { id: true },
  });
  if (editable.length !== input.lines.length) {
    throw new ConflictError("The list changed while you were editing. Reload it and try again.");
  }

  await prisma.$transaction(
    input.lines.map((l) =>
      prisma.incrementListLine.update({
        where: { id: l.id },
        data: {
          demBasic: l.demanded.basic,
          demTransport: l.demanded.transport,
          demHousing: l.demanded.housing,
          demOther: l.demanded.other,
          propBasic: l.proposed.basic,
          propTransport: l.proposed.transport,
          propHousing: l.proposed.housing,
          propOther: l.proposed.other,
        },
      }),
    ),
  );
  return { listId: list.id, title: list.title, saved: input.lines.length };
}

export async function removeListLine(ctx: ActorContext, id: string) {
  requireSalaryView(ctx);
  const line = await prisma.incrementListLine.findFirst({
    where: { id, employee: inScopeEmployee(ctx) },
    select: {
      id: true,
      listId: true,
      list: { select: { title: true } },
      employee: { select: { fullName: true, employeeNo: true } },
    },
  });
  if (!line) throw new NotFoundError("Line not found.");
  await prisma.incrementListLine.delete({ where: { id } });
  return line;
}

/** Every list an employee appears on, for their profile. */
export async function incrementLinesForEmployee(ctx: ActorContext, employeeId: string) {
  if (!ctx.permissions.has("employees.salary.view")) return null;
  const lines = await prisma.incrementListLine.findMany({
    where: { employeeId, employee: inScopeEmployee(ctx) },
    orderBy: { list: { listDate: "desc" } },
    select: { id: true, ...FIGURES, list: { select: { id: true, title: true, listDate: true } } },
  });
  return lines.map((l) => {
    const b = breakdowns(l);
    return {
      id: l.id,
      list: l.list,
      currentTotal: total(b.current),
      demandedIncrement: incrementOf(b.current, b.demanded),
      proposedIncrement: incrementOf(b.current, b.proposed),
      proposedTotal: total(b.proposed),
    };
  });
}

// --- Employee salary ------------------------------------------------------------

export async function salaryFor(ctx: ActorContext, employeeId: string) {
  requireSalaryView(ctx);
  const e = await prisma.employee.findFirst({
    where: { id: employeeId, ...inScopeEmployee(ctx) },
    select: PAY_SELECT,
  });
  if (!e) throw new NotFoundError("Employee not found.");
  return payOf(e);
}

export async function updateEmployeeSalary(ctx: ActorContext, input: EmployeeSalaryInput) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...inScopeEmployee(ctx) },
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      companyId: true,
      ...PAY_SELECT,
    },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  await prisma.employee.update({
    where: { id: employee.id },
    data: Object.fromEntries(PAY_PARTS.map((p) => [PAY_FIELDS[p], input[p]])),
  });

  return {
    employee,
    before: payOf(employee),
    after: Object.fromEntries(PAY_PARTS.map((p) => [p, input[p]])) as Pay,
  };
}
