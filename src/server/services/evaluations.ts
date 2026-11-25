import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  emptyStaffData,
  emptyWorkerData,
  readStaffData,
  readWorkerData,
  timeBetween,
  workerResult,
} from "@/lib/evaluation-forms";
import type {
  AddEvaluationInput,
  EvaluationListInput,
  SaveStaffEvaluationInput,
  SaveWorkerEvaluationInput,
} from "@/lib/schemas/evaluations";

/**
 * Evaluation lists: an evaluation round holding one filled form (Staff or
 * Worker) per employee. Evaluations are scoped through the employee's company.
 */

const inScopeEmployee = (ctx: ActorContext) => ({ ...companyScopeWhere(ctx), deletedAt: null });

/** What a list row shows as the outcome: the worker's points, or the staff final rating. */
function outcomeOf(e: { template: "STAFF" | "WORKER"; data: unknown; finalRating: string | null }) {
  if (e.template === "WORKER") {
    const r = workerResult(readWorkerData(e.data));
    return r === null ? null : `${String(r)}%`;
  }
  return e.finalRating;
}

// --- Lists --------------------------------------------------------------------

export async function listEvaluationLists(ctx: ActorContext) {
  const lists = await prisma.evaluationList.findMany({
    orderBy: [{ listDate: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      title: true,
      listDate: true,
      notes: true,
      evaluations: {
        where: { employee: inScopeEmployee(ctx) },
        select: { template: true },
      },
    },
  });
  return lists.map((l) => ({
    id: l.id,
    title: l.title,
    listDate: l.listDate,
    notes: l.notes,
    staff: l.evaluations.filter((e) => e.template === "STAFF").length,
    workers: l.evaluations.filter((e) => e.template === "WORKER").length,
  }));
}

export async function getEvaluationList(ctx: ActorContext, id: string) {
  const list = await prisma.evaluationList.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      listDate: true,
      notes: true,
      evaluations: {
        where: { employee: inScopeEmployee(ctx) },
        orderBy: [{ employee: { employeeNo: "asc" } }],
        select: {
          id: true,
          template: true,
          evaluationDate: true,
          data: true,
          finalRating: true,
          updatedAt: true,
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
  if (!list) throw new NotFoundError("Evaluation list not found.");
  return {
    ...list,
    evaluations: list.evaluations.map((e) => ({
      id: e.id,
      template: e.template,
      evaluationDate: e.evaluationDate,
      updatedAt: e.updatedAt,
      outcome: outcomeOf(e),
      employee: e.employee,
    })),
  };
}

export async function createEvaluationList(ctx: ActorContext, input: EvaluationListInput) {
  return prisma.evaluationList.create({
    data: {
      title: input.title,
      listDate: input.listDate,
      notes: input.notes ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, title: true },
  });
}

export async function updateEvaluationList(
  _ctx: ActorContext,
  input: EvaluationListInput & { id: string },
) {
  const before = await prisma.evaluationList.findUnique({
    where: { id: input.id },
    select: { id: true, title: true, listDate: true },
  });
  if (!before) throw new NotFoundError("Evaluation list not found.");
  const after = await prisma.evaluationList.update({
    where: { id: input.id },
    data: { title: input.title, listDate: input.listDate, notes: input.notes ?? null },
    select: { id: true, title: true, listDate: true },
  });
  return { before, after };
}

export async function deleteEvaluationList(ctx: ActorContext, id: string) {
  const list = await prisma.evaluationList.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      evaluations: { select: { employee: { select: { companyId: true } } } },
    },
  });
  if (!list) throw new NotFoundError("Evaluation list not found.");
  if (ctx.companyScope !== "ALL") {
    const scope = ctx.companyScope;
    if (list.evaluations.some((e) => !scope.includes(e.employee.companyId))) {
      throw new ForbiddenError("This list includes employees of companies you cannot access.");
    }
  }
  await prisma.evaluationList.delete({ where: { id } });
  return { id: list.id, title: list.title };
}

// --- Evaluations ----------------------------------------------------------------

/** Employees in scope who are not on the list yet. */
export async function employeesForList(ctx: ActorContext, listId: string) {
  const onList = await prisma.evaluation.findMany({
    where: { listId },
    select: { employeeId: true },
  });
  const rows = await prisma.employee.findMany({
    where: {
      ...inScopeEmployee(ctx),
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      id: { notIn: onList.map((e) => e.employeeId) },
    },
    orderBy: [{ company: { code: "asc" } }, { employeeNo: "asc" }],
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      company: { select: { code: true } },
      position: { select: { title: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    name: e.fullName,
    company: e.company.code,
    position: e.position?.title ?? "",
  }));
}

/** Everyone in scope who can be named as the evaluating manager. */
export async function managerOptions(ctx: ActorContext) {
  const rows = await prisma.employee.findMany({
    where: { ...inScopeEmployee(ctx), status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { fullName: "asc" },
    select: { id: true, employeeNo: true, fullName: true, position: { select: { title: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    name: e.fullName,
    position: e.position?.title ?? "",
  }));
}

export async function addEvaluation(ctx: ActorContext, input: AddEvaluationInput) {
  const list = await prisma.evaluationList.findUnique({
    where: { id: input.listId },
    select: { id: true, title: true },
  });
  if (!list) throw new NotFoundError("Evaluation list not found.");
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...inScopeEmployee(ctx) },
    select: {
      id: true,
      employeeNo: true,
      fullName: true,
      companyId: true,
      managerId: true,
      joiningDate: true,
    },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  try {
    const created = await prisma.evaluation.create({
      data: {
        listId: list.id,
        employeeId: employee.id,
        template: input.template,
        evaluationDate: input.evaluationDate,
        // The staff form names a manager; the employee's own manager is the
        // natural default, and can be changed on the form.
        managerId: input.template === "STAFF" ? employee.managerId : null,
        timeInPosition:
          input.template === "STAFF"
            ? timeBetween(employee.joiningDate, input.evaluationDate)
            : null,
        data: input.template === "STAFF" ? emptyStaffData() : emptyWorkerData(),
      },
      select: { id: true },
    });
    return { id: created.id, listId: list.id, listTitle: list.title, employee };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(`${employee.fullName} is already on this list.`);
    }
    throw error;
  }
}

const EMPLOYEE_SELECT = {
  id: true,
  employeeNo: true,
  fullName: true,
  joiningDate: true,
  companyId: true,
  position: { select: { title: true } },
  department: { select: { name: true } },
  company: {
    select: {
      id: true,
      name: true,
      headerImageFileId: true,
    },
  },
} as const;

export async function getEvaluation(ctx: ActorContext, id: string) {
  const e = await prisma.evaluation.findFirst({
    where: { id, employee: inScopeEmployee(ctx) },
    select: {
      id: true,
      template: true,
      evaluationDate: true,
      managerId: true,
      timeInPosition: true,
      pdpStarted: true,
      pdpCompleted: true,
      section: true,
      data: true,
      managerComments: true,
      employeeComments: true,
      finalRating: true,
      list: { select: { id: true, title: true } },
      employee: { select: EMPLOYEE_SELECT },
      manager: {
        select: {
          id: true,
          employeeNo: true,
          fullName: true,
          position: { select: { title: true } },
        },
      },
    },
  });
  if (!e) throw new NotFoundError("Evaluation not found.");

  return {
    ...e,
    staff: e.template === "STAFF" ? readStaffData(e.data) : null,
    worker: e.template === "WORKER" ? readWorkerData(e.data) : null,
  };
}

async function requireEditable(ctx: ActorContext, id: string, template: "STAFF" | "WORKER") {
  const e = await prisma.evaluation.findFirst({
    where: { id, employee: inScopeEmployee(ctx) },
    select: {
      id: true,
      template: true,
      listId: true,
      employee: { select: { fullName: true, employeeNo: true, companyId: true } },
    },
  });
  if (!e) throw new NotFoundError("Evaluation not found.");
  if (e.template !== template) throw new ConflictError("This evaluation uses the other form.");
  return e;
}

export async function saveStaffEvaluation(ctx: ActorContext, input: SaveStaffEvaluationInput) {
  const e = await requireEditable(ctx, input.id, "STAFF");
  if (input.managerId) {
    const manager = await prisma.employee.findFirst({
      where: { id: input.managerId, ...inScopeEmployee(ctx) },
      select: { id: true },
    });
    if (!manager) throw new NotFoundError("Manager not found.");
  }
  await prisma.evaluation.update({
    where: { id: e.id },
    data: {
      evaluationDate: input.evaluationDate,
      managerId: input.managerId ?? null,
      timeInPosition: input.timeInPosition ?? null,
      pdpStarted: input.pdpStarted ?? null,
      pdpCompleted: input.pdpCompleted ?? null,
      data: input.data,
      managerComments: input.managerComments ?? null,
      employeeComments: input.employeeComments ?? null,
      finalRating: input.finalRating ?? null,
    },
  });
  return e;
}

export async function saveWorkerEvaluation(ctx: ActorContext, input: SaveWorkerEvaluationInput) {
  const e = await requireEditable(ctx, input.id, "WORKER");
  await prisma.evaluation.update({
    where: { id: e.id },
    data: {
      evaluationDate: input.evaluationDate,
      section: input.section ?? null,
      data: input.data,
    },
  });
  return e;
}

export async function deleteEvaluation(ctx: ActorContext, id: string) {
  const e = await prisma.evaluation.findFirst({
    where: { id, employee: inScopeEmployee(ctx) },
    select: {
      id: true,
      listId: true,
      list: { select: { title: true } },
      employee: { select: { fullName: true, employeeNo: true, companyId: true } },
    },
  });
  if (!e) throw new NotFoundError("Evaluation not found.");
  await prisma.evaluation.delete({ where: { id } });
  return e;
}

/** For the employee profile tab. */
export async function evaluationsForEmployee(ctx: ActorContext, employeeId: string) {
  const rows = await prisma.evaluation.findMany({
    where: { employeeId, employee: inScopeEmployee(ctx) },
    orderBy: { evaluationDate: "desc" },
    select: {
      id: true,
      template: true,
      evaluationDate: true,
      data: true,
      finalRating: true,
      list: { select: { id: true, title: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    template: r.template,
    evaluationDate: r.evaluationDate,
    list: r.list,
    outcome: outcomeOf(r),
  }));
}
