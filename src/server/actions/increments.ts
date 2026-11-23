"use server";

import {
  addListEmployeesSchema,
  employeeSalarySchema,
  incrementIdSchema,
  incrementListSchema,
  saveListLinesSchema,
  updateIncrementListSchema,
} from "@/lib/schemas/increments";
import { defineAction } from "./define-action";
import {
  addEmployeesToList,
  createIncrementList,
  deleteIncrementList,
  removeListLine,
  saveListLines,
  updateEmployeeSalary,
  updateIncrementList,
} from "@/server/services/increments";

/*
 * Audit entries name what changed but never carry the amounts: the audit log
 * is readable with audit.view, which does not imply employees.salary.view.
 */

const LIST_PATHS = (id?: string) => ["/hr/increments", ...(id ? [`/hr/increments/${id}`] : [])];

export const createIncrementListAction = defineAction({
  permission: "hr.increments.manage",
  schema: incrementListSchema,
  audit: { action: "CREATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const list = await createIncrementList(ctx, input);
    audit.record({ entityId: list.id, summary: `Created increment list “${list.title}”` });
    return { id: list.id };
  },
  revalidate: () => LIST_PATHS(),
});

export const updateIncrementListAction = defineAction({
  permission: "hr.increments.manage",
  schema: updateIncrementListSchema,
  audit: { action: "UPDATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateIncrementList(ctx, input);
    audit.record({
      entityId: after.id,
      summary: `Updated increment list “${after.title}”`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: (input) => LIST_PATHS(input.id),
});

export const deleteIncrementListAction = defineAction({
  permission: "hr.increments.manage",
  schema: incrementIdSchema,
  audit: { action: "DELETE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const list = await deleteIncrementList(ctx, input.id);
    audit.record({ entityId: list.id, summary: `Deleted increment list “${list.title}”` });
    return { id: list.id };
  },
  revalidate: () => LIST_PATHS(),
});

export const addListEmployeesAction = defineAction({
  permission: "hr.increments.manage",
  schema: addListEmployeesSchema,
  audit: { action: "UPDATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const r = await addEmployeesToList(ctx, input);
    audit.record({
      entityId: r.listId,
      summary: `Added ${String(r.added)} employee(s) to increment list “${r.title}”`,
    });
    return { added: r.added, withoutSalary: r.withoutSalary };
  },
  revalidate: (input) => LIST_PATHS(input.listId),
});

export const saveListLinesAction = defineAction({
  permission: "hr.increments.manage",
  schema: saveListLinesSchema,
  audit: { action: "UPDATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const r = await saveListLines(ctx, input);
    audit.record({
      entityId: r.listId,
      summary: `Saved demanded / proposed salaries on increment list “${r.title}” (${String(r.saved)} employee(s))`,
    });
    return { saved: r.saved };
  },
  revalidate: (input) => LIST_PATHS(input.listId),
});

export const removeListLineAction = defineAction({
  permission: "hr.increments.manage",
  schema: incrementIdSchema,
  audit: { action: "UPDATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const line = await removeListLine(ctx, input.id);
    audit.record({
      entityId: line.listId,
      summary: `Removed ${line.employee.employeeNo} — ${line.employee.fullName} from increment list “${line.list.title}”`,
    });
    return { listId: line.listId };
  },
  revalidate: (_input, output) => LIST_PATHS(output.listId),
});

export const updateEmployeeSalaryAction = defineAction({
  permission: "employees.salary.manage",
  schema: employeeSalarySchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const r = await updateEmployeeSalary(ctx, input);
    const changed = (["basic", "transport", "housing", "other"] as const).filter(
      (k) => r.before[k] !== r.after[k],
    );
    audit.record({
      entityId: r.employee.id,
      companyId: r.employee.companyId,
      summary: `Updated salary for ${r.employee.employeeNo} — ${r.employee.fullName}${
        changed.length ? ` (${changed.join(", ")} changed)` : " (no change)"
      }`,
    });
    return { ok: true as const };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`],
});
