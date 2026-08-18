import "server-only";
import type { ChecklistItemStatus, ChecklistType } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/result";
import {
  decideClearance,
  describeClearanceDenial,
} from "@/lib/clearance";

/**
 * Checklist engine — ADR-006.
 *
 * Onboarding, offboarding, and clearance are the same shape: an ordered list of
 * steps with a status, an owner, a due date, and a note. Four tables serve all
 * three, so templates are configurable without a migration and one UI covers
 * every workflow.
 */

const TERMINAL_ITEM_STATUSES: ChecklistItemStatus[] = ["COMPLETED", "NOT_APPLICABLE"];

export async function templatesFor(type: ChecklistType) {
  return prisma.checklistTemplate.findMany({
    where: { type, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, key: true, name: true, _count: { select: { items: true } } },
  });
}

export type ChecklistSummary = {
  id: string;
  type: ChecklistType;
  status: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  companyCode: string;
  templateName: string;
  startedAt: Date;
  targetDate: Date | null;
  completedAt: Date | null;
  totalItems: number;
  doneItems: number;
};

export async function listChecklists(
  ctx: ActorContext,
  type: ChecklistType,
): Promise<ChecklistSummary[]> {
  const rows = await prisma.checklistInstance.findMany({
    where: { type, ...companyScopeWhere(ctx) },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    select: {
      id: true,
      type: true,
      status: true,
      employeeId: true,
      startedAt: true,
      targetDate: true,
      completedAt: true,
      template: { select: { name: true } },
      employee: {
        select: { fullName: true, employeeNo: true, company: { select: { code: true } } },
      },
      items: { select: { status: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    employeeId: r.employeeId,
    employeeName: r.employee.fullName,
    employeeNo: r.employee.employeeNo,
    companyCode: r.employee.company.code,
    templateName: r.template.name,
    startedAt: r.startedAt,
    targetDate: r.targetDate,
    completedAt: r.completedAt,
    totalItems: r.items.length,
    doneItems: r.items.filter((i) => TERMINAL_ITEM_STATUSES.includes(i.status)).length,
  }));
}

export async function getChecklist(ctx: ActorContext, id: string) {
  const instance = await prisma.checklistInstance.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      type: true,
      status: true,
      employeeId: true,
      companyId: true,
      startedAt: true,
      targetDate: true,
      completedAt: true,
      notes: true,
      template: { select: { name: true } },
      employee: { select: { fullName: true, employeeNo: true, status: true } },
      items: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          label: true,
          category: true,
          responsibleDepartmentId: true,
          responsibleRoleId: true,
          status: true,
          dueDate: true,
          completedAt: true,
          notes: true,
        },
      },
    },
  });
  if (!instance) throw new NotFoundError("Checklist not found.");
  return instance;
}

/**
 * Creates an instance by copying the template's items.
 *
 * Copied rather than referenced so that editing a template later never rewrites
 * history on a checklist someone already worked through.
 */
export async function startChecklist(
  ctx: ActorContext,
  input: { employeeId: string; templateId: string; targetDate?: Date | undefined },
) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: input.templateId },
    select: {
      id: true,
      name: true,
      type: true,
      items: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          label: true,
          category: true,
          responsibleDepartmentId: true,
          responsibleRoleId: true,
          defaultDueDays: true,
        },
      },
    },
  });
  if (!template) throw new NotFoundError("Checklist template not found.");
  if (template.items.length === 0) {
    throw new ConflictError("That template has no steps defined.");
  }

  const existing = await prisma.checklistInstance.findFirst({
    where: { employeeId: input.employeeId, type: template.type, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      `This employee already has an in-progress ${template.type.toLowerCase()} checklist.`,
    );
  }

  const start = new Date();

  return prisma.$transaction(async (tx) => {
    const instance = await tx.checklistInstance.create({
      data: {
        templateId: template.id,
        type: template.type,
        employeeId: employee.id,
        companyId: employee.companyId,
        startedAt: start,
        targetDate: input.targetDate ?? null,
        createdById: ctx.userId,
      },
      select: { id: true, type: true },
    });

    await tx.checklistItem.createMany({
      data: template.items.map((item) => ({
        instanceId: instance.id,
        templateItemId: item.id,
        order: item.order,
        label: item.label,
        category: item.category,
        // Snapshotted, not read through the template: editing a template must
        // not change who may sign off an exit that is already running.
        responsibleDepartmentId: item.responsibleDepartmentId,
        responsibleRoleId: item.responsibleRoleId,
        dueDate:
          item.defaultDueDays === null
            ? null
            : new Date(start.getTime() + item.defaultDueDays * 24 * 60 * 60 * 1000),
      })),
    });

    return { ...instance, employeeName: employee.fullName, templateName: template.name };
  });
}

export async function setChecklistItemStatus(
  ctx: ActorContext,
  input: { itemId: string; status: ChecklistItemStatus; notes?: string | undefined },
) {
  const item = await prisma.checklistItem.findFirst({
    where: { id: input.itemId, instance: companyScopeWhere(ctx) },
    select: {
      id: true,
      label: true,
      status: true,
      instanceId: true,
      responsibleDepartmentId: true,
      responsibleRoleId: true,
      instance: {
        select: { id: true, type: true, status: true, companyId: true, employeeId: true },
      },
    },
  });
  if (!item) throw new NotFoundError("Checklist item not found.");

  if (item.instance.status !== "IN_PROGRESS") {
    throw new ConflictError("This checklist is closed and can no longer be edited.");
  }

  const isDone = TERMINAL_ITEM_STATUSES.includes(input.status);

  // Departmental sign-off. Only checked when the step is actually being closed:
  // moving one back to PENDING is a correction, not a confirmation.
  let viaOverride = false;
  if (isDone) {
    const decision = decideClearance(item, await clearanceActorFor(ctx));
    if (!decision.allowed) {
      throw new ForbiddenError(describeClearanceDenial(decision.reason));
    }
    viaOverride = decision.viaOverride;
  }

  await prisma.checklistItem.update({
    where: { id: input.itemId },
    data: {
      status: input.status,
      notes: input.notes ?? null,
      completedAt: isDone ? new Date() : null,
      completedById: isDone ? ctx.userId : null,
    },
  });

  return {
    before: { status: item.status },
    after: { status: input.status },
    label: item.label,
    instance: item.instance,
    // Surfaced so the audit entry can record that a departmental step was
    // signed off from outside the department that owns it.
    viaOverride,
  };
}

/**
 * Gathers what the clearance rule needs about the actor.
 *
 * The decision itself is a pure function in `lib/clearance.ts`; this only
 * resolves the actor's employee record and the departments they head.
 */
async function clearanceActorFor(ctx: ActorContext) {
  const employee = ctx.employeeId
    ? await prisma.employee.findUnique({
        where: { id: ctx.employeeId },
        select: { departmentId: true, headedDepartments: { select: { id: true } } },
      })
    : null;

  return {
    canConfirm: ctx.permissions.has("hr.clearance.confirm"),
    // The deadlock escape: without it, a system whose administrators have no
    // employee record could never close a departmental step at all.
    canOverride: ctx.permissions.has("companies.viewAll"),
    employee: employee
      ? {
          departmentId: employee.departmentId,
          headsDepartmentIds: employee.headedDepartments.map((d) => d.id),
        }
      : null,
    roleId: ctx.roleId,
  };
}

export type OutstandingItems = {
  unreturnedAssets: { id: string; assetCode: string; brand: string; model: string }[];
  activeAccommodation: { id: string; label: string }[];
  openTasks: { id: string; taskNo: string; title: string }[];
  incompleteSteps: number;
};

/**
 * What still stands between this employee and a clean exit (brief §50).
 *
 * Offboarding cannot be completed while any of these remain — otherwise a
 * leaver walks out holding a laptop and the record says they are cleared.
 */
export async function outstandingForEmployee(
  ctx: ActorContext,
  employeeId: string,
  instanceId?: string,
): Promise<OutstandingItems> {
  const [assets, beds, tasks, steps] = await Promise.all([
    prisma.iTAssetAssignment.findMany({
      where: { employeeId, returnedAt: null },
      select: { id: true, asset: { select: { assetCode: true, brand: true, model: true } } },
    }),
    prisma.bedAssignment.findMany({
      where: { employeeId, checkOutDate: null },
      select: {
        id: true,
        bed: {
          select: {
            bedLabel: true,
            room: {
              select: { roomNumber: true, accommodation: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        entityType: "EMPLOYEE",
        entityId: employeeId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        ...companyScopeWhere(ctx),
      },
      select: { id: true, taskNo: true, title: true },
    }),
    instanceId
      ? prisma.checklistItem.count({
          where: { instanceId, status: { notIn: TERMINAL_ITEM_STATUSES } },
        })
      : Promise.resolve(0),
  ]);

  return {
    unreturnedAssets: assets.map((a) => ({
      id: a.id,
      assetCode: a.asset.assetCode,
      brand: a.asset.brand,
      model: a.asset.model,
    })),
    activeAccommodation: beds.map((b) => ({
      id: b.id,
      label: `${b.bed.room.accommodation.name} · Room ${b.bed.room.roomNumber} · Bed ${b.bed.bedLabel}`,
    })),
    openTasks: tasks,
    incompleteSteps: steps,
  };
}

/**
 * Closes a checklist.
 *
 * For offboarding this is the gate: outstanding assets, accommodation, or tasks
 * block completion, so "cleared" always means cleared.
 */
export async function completeChecklist(ctx: ActorContext, instanceId: string) {
  const instance = await getChecklist(ctx, instanceId);

  if (instance.status !== "IN_PROGRESS") {
    throw new ConflictError("This checklist is already closed.");
  }

  const incomplete = instance.items.filter(
    (i) => !TERMINAL_ITEM_STATUSES.includes(i.status),
  );
  if (incomplete.length > 0) {
    throw new ConflictError(
      `${String(incomplete.length)} step${incomplete.length === 1 ? "" : "s"} still outstanding: ${incomplete
        .slice(0, 3)
        .map((i) => i.label)
        .join(", ")}${incomplete.length > 3 ? "…" : ""}`,
    );
  }

  if (instance.type === "OFFBOARDING") {
    const outstanding = await outstandingForEmployee(ctx, instance.employeeId);
    const blockers: string[] = [];

    if (outstanding.unreturnedAssets.length > 0) {
      blockers.push(
        `${String(outstanding.unreturnedAssets.length)} IT asset(s) not returned`,
      );
    }
    if (outstanding.activeAccommodation.length > 0) {
      blockers.push("accommodation not vacated");
    }
    if (outstanding.openTasks.length > 0) {
      blockers.push(`${String(outstanding.openTasks.length)} open task(s)`);
    }

    if (blockers.length > 0) {
      throw new ConflictError(`Cannot complete offboarding: ${blockers.join("; ")}.`);
    }
  }

  await prisma.checklistInstance.update({
    where: { id: instanceId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return {
    type: instance.type,
    employeeName: instance.employee.fullName,
    companyId: instance.companyId,
  };
}

/** Checklists for one employee — powers the profile tabs. */
export async function checklistsForEmployee(ctx: ActorContext, employeeId: string) {
  return prisma.checklistInstance.findMany({
    where: { employeeId, ...companyScopeWhere(ctx) },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      startedAt: true,
      completedAt: true,
      template: { select: { name: true } },
      items: { select: { status: true } },
    },
  });
}
