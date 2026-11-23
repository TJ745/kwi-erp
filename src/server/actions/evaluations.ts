"use server";

import {
  addEvaluationSchema,
  evaluationIdSchema,
  evaluationListSchema,
  saveStaffEvaluationSchema,
  saveWorkerEvaluationSchema,
  updateEvaluationListSchema,
} from "@/lib/schemas/evaluations";
import { defineAction } from "./define-action";
import {
  addEvaluation,
  createEvaluationList,
  deleteEvaluation,
  deleteEvaluationList,
  saveStaffEvaluation,
  saveWorkerEvaluation,
  updateEvaluationList,
} from "@/server/services/evaluations";

const paths = (listId?: string, evaluationId?: string) => [
  "/hr/evaluations",
  ...(listId ? [`/hr/evaluations/${listId}`] : []),
  ...(listId && evaluationId ? [`/hr/evaluations/${listId}/${evaluationId}`] : []),
];

export const createEvaluationListAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: evaluationListSchema,
  audit: { action: "CREATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const list = await createEvaluationList(ctx, input);
    audit.record({ entityId: list.id, summary: `Created evaluation list “${list.title}”` });
    return { id: list.id };
  },
  revalidate: () => paths(),
});

export const updateEvaluationListAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: updateEvaluationListSchema,
  audit: { action: "UPDATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateEvaluationList(ctx, input);
    audit.record({
      entityId: after.id,
      summary: `Updated evaluation list “${after.title}”`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: (input) => paths(input.id),
});

export const deleteEvaluationListAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: evaluationIdSchema,
  audit: { action: "DELETE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const list = await deleteEvaluationList(ctx, input.id);
    audit.record({ entityId: list.id, summary: `Deleted evaluation list “${list.title}”` });
    return { id: list.id };
  },
  revalidate: () => paths(),
});

export const addEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: addEvaluationSchema,
  audit: { action: "CREATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const r = await addEvaluation(ctx, input);
    audit.record({
      entityId: r.id,
      companyId: r.employee.companyId,
      summary: `Added ${r.employee.employeeNo} — ${r.employee.fullName} to evaluation list “${r.listTitle}” (${input.template.toLowerCase()} form)`,
    });
    return { id: r.id, listId: r.listId };
  },
  revalidate: (input) => paths(input.listId),
});

export const saveStaffEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: saveStaffEvaluationSchema,
  audit: { action: "UPDATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const e = await saveStaffEvaluation(ctx, input);
    audit.record({
      entityId: e.id,
      companyId: e.employee.companyId,
      summary: `Saved staff evaluation of ${e.employee.employeeNo} — ${e.employee.fullName}`,
    });
    return { id: e.id, listId: e.listId };
  },
  revalidate: (_input, output) => paths(output.listId, output.id),
});

export const saveWorkerEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: saveWorkerEvaluationSchema,
  audit: { action: "UPDATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const e = await saveWorkerEvaluation(ctx, input);
    audit.record({
      entityId: e.id,
      companyId: e.employee.companyId,
      summary: `Saved worker appraisal of ${e.employee.employeeNo} — ${e.employee.fullName}`,
    });
    return { id: e.id, listId: e.listId };
  },
  revalidate: (_input, output) => paths(output.listId, output.id),
});

export const deleteEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: evaluationIdSchema,
  audit: { action: "DELETE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const e = await deleteEvaluation(ctx, input.id);
    audit.record({
      entityId: e.id,
      companyId: e.employee.companyId,
      summary: `Removed ${e.employee.employeeNo} — ${e.employee.fullName} from evaluation list “${e.list.title}”`,
    });
    return { listId: e.listId };
  },
  revalidate: (_input, output) => paths(output.listId),
});
