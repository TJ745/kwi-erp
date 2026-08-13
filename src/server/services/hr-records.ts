import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  incrementFigures,
  overallScore,
  suggestedNextLevel,
  type WarningLevel,
} from "@/lib/hr-calc";
import type {
  CorrespondenceInput,
  EvaluationInput,
  IncrementInput,
  WarningInput,
} from "@/lib/schemas/hr-records";

/**
 * Warnings, correspondence, increments, and evaluations — brief §19–§22.
 *
 * All four hang off an employee, so all four are scoped through the employee's
 * company rather than carrying their own scope column (except Correspondence,
 * which can exist without an employee and therefore has one).
 */

/** Employee-owned records reach their company through the relation. */
function employeeScope(ctx: ActorContext) {
  return { employee: { ...companyScopeWhere(ctx), deletedAt: null } };
}

async function assertEmployeeInScope(ctx: ActorContext, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, employeeNo: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");
  return employee;
}

// --- Warning letters ---------------------------------------------------------

export async function listWarnings(
  ctx: ActorContext,
  filters: { employeeId?: string | undefined; level?: string | undefined } = {},
) {
  return prisma.warningLetter.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.level ? { level: filters.level as WarningLevel } : {}),
    },
    orderBy: { issuedDate: "desc" },
    take: 500,
    select: {
      id: true,
      level: true,
      reason: true,
      description: true,
      issuedDate: true,
      acknowledgedAt: true,
      issuedById: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeNo: true,
          company: { select: { code: true } },
        },
      },
    },
  });
}

/** Prior warnings for one employee, and what would normally come next. */
export async function warningHistory(ctx: ActorContext, employeeId: string) {
  await assertEmployeeInScope(ctx, employeeId);

  const previous = await prisma.warningLetter.findMany({
    where: { employeeId },
    orderBy: { issuedDate: "asc" },
    select: { id: true, level: true, issuedDate: true, reason: true },
  });

  return {
    previous,
    suggested: suggestedNextLevel(previous.map((p) => p.level)),
  };
}

export async function createWarning(ctx: ActorContext, input: WarningInput) {
  const employee = await assertEmployeeInScope(ctx, input.employeeId);

  const warning = await prisma.warningLetter.create({
    data: {
      employeeId: input.employeeId,
      level: input.level,
      reason: input.reason,
      description: input.description,
      issuedDate: input.issuedDate,
      issuedById: ctx.userId,
    },
    select: { id: true, level: true, reason: true, issuedDate: true },
  });

  return { ...warning, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function updateWarning(
  ctx: ActorContext,
  input: WarningInput & { id: string },
) {
  const before = await prisma.warningLetter.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      level: true,
      reason: true,
      issuedDate: true,
      acknowledgedAt: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!before) throw new NotFoundError("Warning not found.");

  // Once the employee has signed for it, the text is what they signed for.
  if (before.acknowledgedAt) {
    throw new ConflictError(
      "This warning has been acknowledged by the employee and can no longer be edited.",
    );
  }

  const after = await prisma.warningLetter.update({
    where: { id: input.id },
    data: {
      level: input.level,
      reason: input.reason,
      description: input.description,
      issuedDate: input.issuedDate,
    },
    select: { id: true, level: true, reason: true, issuedDate: true },
  });

  return {
    before: { level: before.level, reason: before.reason, issuedDate: before.issuedDate },
    after,
    employeeName: before.employee.fullName,
    companyId: before.employee.companyId,
  };
}

export async function acknowledgeWarning(
  ctx: ActorContext,
  input: { id: string; acknowledgedAt: Date },
) {
  const warning = await prisma.warningLetter.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      level: true,
      acknowledgedAt: true,
      issuedDate: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!warning) throw new NotFoundError("Warning not found.");
  if (warning.acknowledgedAt) throw new ConflictError("Already acknowledged.");
  if (input.acknowledgedAt.getTime() < warning.issuedDate.getTime()) {
    throw new ConflictError("Acknowledgement cannot predate the warning.");
  }

  await prisma.warningLetter.update({
    where: { id: input.id },
    data: { acknowledgedAt: input.acknowledgedAt },
  });

  return {
    id: warning.id,
    level: warning.level,
    employeeName: warning.employee.fullName,
    companyId: warning.employee.companyId,
  };
}

export async function deleteWarning(ctx: ActorContext, id: string) {
  const warning = await prisma.warningLetter.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      level: true,
      reason: true,
      acknowledgedAt: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!warning) throw new NotFoundError("Warning not found.");
  if (warning.acknowledgedAt) {
    throw new ConflictError(
      "An acknowledged warning is part of the disciplinary record and cannot be deleted.",
    );
  }

  await prisma.warningLetter.delete({ where: { id } });
  return {
    ...warning,
    employeeName: warning.employee.fullName,
    companyId: warning.employee.companyId,
  };
}

// --- Correspondence ----------------------------------------------------------

export async function listCorrespondence(
  ctx: ActorContext,
  filters: {
    status?: string | undefined;
    type?: string | undefined;
    q?: string | undefined;
    employeeId?: string | undefined;
  } = {},
) {
  return prisma.correspondence.findMany({
    where: {
      ...companyScopeWhere(ctx),
      ...(filters.status ? { status: filters.status as "DRAFT" } : {}),
      ...(filters.type ? { type: filters.type as "VISA" } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.q
        ? {
            OR: [
              { subject: { contains: filters.q, mode: "insensitive" as const } },
              { recipient: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ followUpDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      type: true,
      subject: true,
      recipient: true,
      sentDate: true,
      status: true,
      followUpDate: true,
      notes: true,
      companyId: true,
      employeeId: true,
      company: { select: { code: true } },
      employee: { select: { id: true, fullName: true } },
    },
  });
}

export async function createCorrespondence(
  ctx: ActorContext,
  input: CorrespondenceInput,
) {
  requireCompanyAccess(ctx, input.companyId);
  if (input.employeeId) {
    const employee = await assertEmployeeInScope(ctx, input.employeeId);
    if (employee.companyId !== input.companyId) {
      throw new ConflictError("That employee belongs to a different company.");
    }
  }

  return prisma.correspondence.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId ?? null,
      type: input.type,
      subject: input.subject,
      recipient: input.recipient,
      sentDate: input.sentDate ?? null,
      status: input.status,
      followUpDate: input.followUpDate ?? null,
      notes: input.notes ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, subject: true, recipient: true, status: true, companyId: true },
  });
}

export async function updateCorrespondence(
  ctx: ActorContext,
  input: CorrespondenceInput & { id: string },
) {
  const before = await prisma.correspondence.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      subject: true,
      status: true,
      sentDate: true,
      followUpDate: true,
      companyId: true,
    },
  });
  if (!before) throw new NotFoundError("Correspondence not found.");
  requireCompanyAccess(ctx, input.companyId);

  const after = await prisma.correspondence.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId ?? null,
      type: input.type,
      subject: input.subject,
      recipient: input.recipient,
      sentDate: input.sentDate ?? null,
      status: input.status,
      followUpDate: input.followUpDate ?? null,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      subject: true,
      status: true,
      sentDate: true,
      followUpDate: true,
      companyId: true,
    },
  });

  return { before, after };
}

export async function deleteCorrespondence(ctx: ActorContext, id: string) {
  const item = await prisma.correspondence.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: { id: true, subject: true, companyId: true, _count: { select: { iqamaRenewals: true } } },
  });
  if (!item) throw new NotFoundError("Correspondence not found.");
  if (item._count.iqamaRenewals > 0) {
    throw new ConflictError(
      "This correspondence is linked to an Iqama renewal and cannot be deleted.",
    );
  }

  await prisma.correspondence.delete({ where: { id } });
  return item;
}

export async function correspondenceCounts(ctx: ActorContext) {
  const scope = companyScopeWhere(ctx);
  const now = new Date();

  const [drafts, waiting, followUpDue] = await Promise.all([
    prisma.correspondence.count({ where: { status: "DRAFT", ...scope } }),
    prisma.correspondence.count({ where: { status: "WAITING", ...scope } }),
    // Overdue follow-ups are what this module exists to stop being forgotten.
    prisma.correspondence.count({
      where: {
        status: { notIn: ["COMPLETED"] },
        followUpDate: { lte: now },
        ...scope,
      },
    }),
  ]);

  return { drafts, waiting, followUpDue };
}

// --- Increments --------------------------------------------------------------

/**
 * Increments, with the salary figures withheld unless permitted.
 *
 * The figures are stripped HERE, not in the page, so they never reach the
 * browser at all. Rendering a table without the salary column while still
 * passing the numbers into a client component would leave them sitting in the
 * RSC payload — which is precisely the leak docs/SECURITY.md §7 describes.
 */
export async function listIncrements(
  ctx: ActorContext,
  filters: { status?: string | undefined; employeeId?: string | undefined } = {},
) {
  const canSeeFigures = ctx.permissions.has("employees.salary.view");

  const rows = await prisma.increment.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    orderBy: [{ status: "asc" }, { effectiveDate: "desc" }],
    take: 500,
    select: {
      id: true,
      currentSalary: true,
      newSalary: true,
      amount: true,
      percentage: true,
      currency: true,
      effectiveDate: true,
      status: true,
      requestedById: true,
      approvedById: true,
      decidedAt: true,
      notes: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeNo: true,
          company: { select: { code: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    currency: row.currency,
    effectiveDate: row.effectiveDate,
    status: row.status,
    requestedById: row.requestedById,
    approvedById: row.approvedById,
    decidedAt: row.decidedAt,
    notes: row.notes,
    employeeId: row.employeeId,
    employee: row.employee,
    // Null rather than absent, so the row shape stays uniform and the renderer
    // cannot accidentally index into a missing key.
    currentSalary: canSeeFigures ? row.currentSalary.toString() : null,
    newSalary: canSeeFigures ? row.newSalary.toString() : null,
    amount: canSeeFigures ? row.amount.toString() : null,
    percentage: canSeeFigures ? row.percentage.toString() : null,
  }));
}

/**
 * The employee's current basic salary, for pre-filling an increment request.
 *
 * Gated on `employees.salary.view` as well as employee scope. Employee scope
 * alone is NOT enough: this returns a salary, and the whole point of that
 * permission is that holding `hr.increments.manage` does not imply holding it.
 *
 * The gate is here rather than at a call site because there is currently no
 * call site — and an ungated salary read sitting ready to be wired up is
 * exactly how the increments-table leak happened.
 */
export async function currentSalaryFor(ctx: ActorContext, employeeId: string) {
  await assertEmployeeInScope(ctx, employeeId);

  if (!ctx.permissions.has("employees.salary.view")) {
    throw new ForbiddenError("You do not have permission to view salary details.");
  }

  const contract = await prisma.contract.findFirst({
    where: { employeeId, status: "ACTIVE", deletedAt: null },
    orderBy: { startDate: "desc" },
    select: { id: true, basicSalary: true, currency: true },
  });

  return {
    contractId: contract?.id ?? null,
    basicSalary: contract?.basicSalary?.toString() ?? null,
    currency: contract?.currency ?? "SAR",
  };
}

export async function createIncrement(ctx: ActorContext, input: IncrementInput) {
  const employee = await assertEmployeeInScope(ctx, input.employeeId);

  // Derived here so they cannot contradict the salaries they came from.
  const figures = incrementFigures(input.currentSalary, input.newSalary);

  const pendingAlready = await prisma.increment.findFirst({
    where: { employeeId: input.employeeId, status: "PENDING" },
    select: { id: true },
  });
  if (pendingAlready) {
    throw new ConflictError(
      `${employee.fullName} already has an increment awaiting a decision.`,
    );
  }

  const increment = await prisma.increment.create({
    data: {
      employeeId: input.employeeId,
      currentSalary: input.currentSalary,
      newSalary: input.newSalary,
      amount: figures.amount,
      percentage: figures.percentage,
      currency: input.currency,
      effectiveDate: input.effectiveDate,
      status: "PENDING",
      requestedById: ctx.userId,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      amount: true,
      percentage: true,
      newSalary: true,
      currency: true,
      effectiveDate: true,
    },
  });

  return { ...increment, employeeName: employee.fullName, companyId: employee.companyId };
}

export async function updateIncrement(
  ctx: ActorContext,
  input: IncrementInput & { id: string },
) {
  const before = await prisma.increment.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      status: true,
      currentSalary: true,
      newSalary: true,
      amount: true,
      percentage: true,
      effectiveDate: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!before) throw new NotFoundError("Increment not found.");

  // A decided increment has already moved the contract — or been refused.
  // Editing it afterwards would rewrite what somebody signed off.
  if (before.status !== "PENDING") {
    throw new ConflictError(
      `This increment is ${before.status.toLowerCase()} and can no longer be edited.`,
    );
  }

  const figures = incrementFigures(input.currentSalary, input.newSalary);

  const after = await prisma.increment.update({
    where: { id: input.id },
    data: {
      employeeId: input.employeeId,
      currentSalary: input.currentSalary,
      newSalary: input.newSalary,
      amount: figures.amount,
      percentage: figures.percentage,
      currency: input.currency,
      effectiveDate: input.effectiveDate,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      newSalary: true,
      amount: true,
      percentage: true,
      effectiveDate: true,
    },
  });

  return {
    before: {
      newSalary: before.newSalary.toString(),
      amount: before.amount.toString(),
      percentage: before.percentage.toString(),
    },
    after: {
      id: after.id,
      newSalary: after.newSalary.toString(),
      amount: after.amount.toString(),
      percentage: after.percentage.toString(),
    },
    employeeName: before.employee.fullName,
    companyId: before.employee.companyId,
  };
}

/**
 * Approves or rejects an increment.
 *
 * On approval the employee's ACTIVE contract is updated to the new salary in
 * the same transaction. Without that the increment is a note nobody acts on,
 * and the contract keeps saying the old figure — which is what a salary letter
 * would then quote.
 */
export async function decideIncrement(
  ctx: ActorContext,
  input: { id: string; decision: "APPROVED" | "REJECTED"; notes?: string | undefined },
) {
  const increment = await prisma.increment.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      status: true,
      newSalary: true,
      currentSalary: true,
      amount: true,
      percentage: true,
      currency: true,
      effectiveDate: true,
      employeeId: true,
      requestedById: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!increment) throw new NotFoundError("Increment not found.");

  if (increment.status !== "PENDING") {
    throw new ConflictError(`That increment is already ${increment.status.toLowerCase()}.`);
  }
  // Same separation of duties as petty cash.
  if (increment.requestedById === ctx.userId) {
    throw new ForbiddenError("You cannot approve an increment you requested yourself.");
  }

  const contract = await prisma.contract.findFirst({
    where: { employeeId: increment.employeeId, status: "ACTIVE", deletedAt: null },
    orderBy: { startDate: "desc" },
    select: { id: true, basicSalary: true },
  });

  if (input.decision === "APPROVED" && !contract) {
    throw new ConflictError(
      `${increment.employee.fullName} has no active contract to apply this increment to.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.increment.update({
      where: { id: input.id },
      data: {
        status: input.decision,
        approvedById: ctx.userId,
        decidedAt: new Date(),
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    if (input.decision === "APPROVED" && contract) {
      await tx.contract.update({
        where: { id: contract.id },
        data: { basicSalary: increment.newSalary },
      });
    }
  });

  return {
    id: increment.id,
    employeeName: increment.employee.fullName,
    companyId: increment.employee.companyId,
    before: increment.status,
    after: input.decision,
    previousSalary: contract?.basicSalary?.toString() ?? null,
    newSalary: increment.newSalary.toString(),
    currency: increment.currency,
    contractUpdated: input.decision === "APPROVED" && contract !== null,
  };
}

export async function deleteIncrement(ctx: ActorContext, id: string) {
  const increment = await prisma.increment.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      status: true,
      newSalary: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!increment) throw new NotFoundError("Increment not found.");
  if (increment.status === "APPROVED") {
    throw new ConflictError(
      "An approved increment has already changed the contract and cannot be deleted.",
    );
  }

  await prisma.increment.delete({ where: { id } });
  return {
    id: increment.id,
    employeeName: increment.employee.fullName,
    companyId: increment.employee.companyId,
  };
}

// --- Evaluations -------------------------------------------------------------

export async function listEvaluations(
  ctx: ActorContext,
  filters: { status?: string | undefined; employeeId?: string | undefined } = {},
) {
  return prisma.evaluation.findMany({
    where: {
      ...employeeScope(ctx),
      ...(filters.status ? { status: filters.status as "PENDING" } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    orderBy: { periodEnd: "desc" },
    take: 500,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      overallScore: true,
      summary: true,
      status: true,
      employeeId: true,
      evaluatorId: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeNo: true,
          company: { select: { code: true } },
        },
      },
      evaluator: { select: { id: true, fullName: true } },
      _count: { select: { scores: true } },
    },
  });
}

export async function getEvaluation(ctx: ActorContext, id: string) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      overallScore: true,
      summary: true,
      status: true,
      employeeId: true,
      evaluatorId: true,
      employee: {
        select: { id: true, fullName: true, employeeNo: true, companyId: true },
      },
      evaluator: { select: { id: true, fullName: true } },
      scores: {
        orderBy: { criterion: "asc" },
        select: {
          id: true,
          criterion: true,
          weight: true,
          score: true,
          comment: true,
        },
      },
    },
  });
  if (!evaluation) throw new NotFoundError("Evaluation not found.");
  return evaluation;
}

export async function createEvaluation(ctx: ActorContext, input: EvaluationInput) {
  const employee = await assertEmployeeInScope(ctx, input.employeeId);
  const evaluator = await assertEmployeeInScope(ctx, input.evaluatorId);

  if (evaluator.companyId !== employee.companyId) {
    throw new ConflictError("The evaluator belongs to a different company.");
  }

  // Computed from the criteria, never accepted from the client.
  const score = overallScore(input.scores);

  const evaluation = await prisma.evaluation.create({
    data: {
      employeeId: input.employeeId,
      evaluatorId: input.evaluatorId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      summary: input.summary ?? null,
      overallScore: score,
      status: "PENDING",
      scores: {
        create: input.scores.map((s) => ({
          criterion: s.criterion,
          weight: s.weight,
          score: s.score,
          comment: s.comment ?? null,
        })),
      },
    },
    select: { id: true, overallScore: true, periodEnd: true },
  });

  return {
    ...evaluation,
    employeeName: employee.fullName,
    evaluatorName: evaluator.fullName,
    companyId: employee.companyId,
  };
}

export async function updateEvaluation(
  ctx: ActorContext,
  input: EvaluationInput & { id: string },
) {
  const before = await prisma.evaluation.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      status: true,
      overallScore: true,
      periodEnd: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!before) throw new NotFoundError("Evaluation not found.");
  if (before.status !== "PENDING") {
    throw new ConflictError(
      `This evaluation is ${before.status.toLowerCase()} and can no longer be edited.`,
    );
  }

  const score = overallScore(input.scores);

  const after = await prisma.$transaction(async (tx) => {
    // Criteria are replaced wholesale: editing a review means restating it,
    // and diffing rows by index would silently reattach the wrong comment.
    await tx.evaluationScore.deleteMany({ where: { evaluationId: input.id } });

    return tx.evaluation.update({
      where: { id: input.id },
      data: {
        employeeId: input.employeeId,
        evaluatorId: input.evaluatorId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        summary: input.summary ?? null,
        overallScore: score,
        scores: {
          create: input.scores.map((s) => ({
            criterion: s.criterion,
            weight: s.weight,
            score: s.score,
            comment: s.comment ?? null,
          })),
        },
      },
      select: { id: true, overallScore: true, periodEnd: true },
    });
  });

  return {
    before: { overallScore: before.overallScore?.toString() ?? null },
    after: { ...after, overallScore: after.overallScore?.toString() ?? null },
    employeeName: before.employee.fullName,
    companyId: before.employee.companyId,
  };
}

export async function decideEvaluation(
  ctx: ActorContext,
  input: { id: string; decision: "APPROVED" | "REJECTED" },
) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: input.id, ...employeeScope(ctx) },
    select: {
      id: true,
      status: true,
      overallScore: true,
      employee: { select: { fullName: true, companyId: true } },
      evaluator: { select: { id: true } },
    },
  });
  if (!evaluation) throw new NotFoundError("Evaluation not found.");
  if (evaluation.status !== "PENDING") {
    throw new ConflictError(`Already ${evaluation.status.toLowerCase()}.`);
  }

  await prisma.evaluation.update({
    where: { id: input.id },
    data: { status: input.decision },
  });

  return {
    id: evaluation.id,
    employeeName: evaluation.employee.fullName,
    companyId: evaluation.employee.companyId,
    overallScore: evaluation.overallScore?.toString() ?? null,
    before: evaluation.status,
    after: input.decision,
  };
}

export async function deleteEvaluation(ctx: ActorContext, id: string) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id, ...employeeScope(ctx) },
    select: {
      id: true,
      status: true,
      employee: { select: { fullName: true, companyId: true } },
    },
  });
  if (!evaluation) throw new NotFoundError("Evaluation not found.");
  if (evaluation.status === "APPROVED") {
    throw new ConflictError(
      "An approved evaluation is part of the employee's record and cannot be deleted.",
    );
  }

  // Scores cascade with the evaluation.
  await prisma.evaluation.delete({ where: { id } });
  return {
    id: evaluation.id,
    employeeName: evaluation.employee.fullName,
    companyId: evaluation.employee.companyId,
  };
}

/** Employees selectable across the actor's scope. */
export async function employeeOptions(ctx: ActorContext) {
  return prisma.employee.findMany({
    where: { deletedAt: null, ...companyScopeWhere(ctx) },
    orderBy: { fullName: "asc" },
    take: 1000,
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      companyId: true,
      company: { select: { code: true } },
    },
  });
}
