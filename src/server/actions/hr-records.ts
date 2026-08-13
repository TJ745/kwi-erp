"use server";

import {
  acknowledgeWarningSchema,
  correspondenceSchema,
  decideEvaluationSchema,
  decideIncrementSchema,
  evaluationSchema,
  hrRecordIdSchema,
  incrementSchema,
  updateCorrespondenceSchema,
  updateEvaluationSchema,
  updateIncrementSchema,
  updateWarningSchema,
  warningSchema,
} from "@/lib/schemas/hr-records";
import { defineAction } from "./define-action";
import {
  acknowledgeWarning,
  createCorrespondence,
  createEvaluation,
  createIncrement,
  createWarning,
  decideEvaluation,
  decideIncrement,
  deleteCorrespondence,
  deleteEvaluation,
  deleteIncrement,
  deleteWarning,
  updateCorrespondence,
  updateEvaluation,
  updateIncrement,
  updateWarning,
} from "@/server/services/hr-records";

const WARNING_PATHS = ["/hr/warnings"];
const CORRESPONDENCE_PATHS = ["/hr/correspondence"];
const INCREMENT_PATHS = ["/hr/increments"];
const EVALUATION_PATHS = ["/hr/evaluations"];

// --- Warnings ----------------------------------------------------------------

export const createWarningAction = defineAction({
  permission: "hr.warnings.manage",
  schema: warningSchema,
  audit: { action: "CREATE", entity: "WARNING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const w = await createWarning(ctx, input);
    audit.record({
      entityId: w.id,
      companyId: w.companyId,
      summary: `Issued ${w.level.replace(/_/g, " ").toLowerCase()} warning to ${w.employeeName} — ${w.reason}`,
      after: { level: w.level, reason: w.reason, issuedDate: w.issuedDate },
    });
    return { id: w.id };
  },
  revalidate: () => WARNING_PATHS,
});

export const updateWarningAction = defineAction({
  permission: "hr.warnings.manage",
  schema: updateWarningSchema,
  audit: { action: "UPDATE", entity: "WARNING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, employeeName, companyId } = await updateWarning(ctx, input);
    audit.record({
      entityId: after.id,
      companyId,
      summary: `Updated warning for ${employeeName}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => WARNING_PATHS,
});

export const acknowledgeWarningAction = defineAction({
  permission: "hr.warnings.manage",
  schema: acknowledgeWarningSchema,
  audit: { action: "UPDATE", entity: "WARNING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const w = await acknowledgeWarning(ctx, input);
    audit.record({
      entityId: w.id,
      companyId: w.companyId,
      summary: `${w.employeeName} acknowledged their ${w.level.replace(/_/g, " ").toLowerCase()} warning`,
      after: { acknowledgedAt: input.acknowledgedAt },
    });
    return { id: w.id };
  },
  revalidate: () => WARNING_PATHS,
});

export const deleteWarningAction = defineAction({
  permission: "hr.warnings.manage",
  schema: hrRecordIdSchema,
  audit: { action: "DELETE", entity: "WARNING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const w = await deleteWarning(ctx, input.id);
    audit.record({
      entityId: w.id,
      companyId: w.companyId,
      summary: `Deleted unacknowledged warning for ${w.employeeName} — ${w.reason}`,
    });
    return { id: w.id };
  },
  revalidate: () => WARNING_PATHS,
});

// --- Correspondence ----------------------------------------------------------

export const createCorrespondenceAction = defineAction({
  permission: "hr.correspondence.manage",
  schema: correspondenceSchema,
  audit: { action: "CREATE", entity: "CORRESPONDENCE" },
  handler: async ({ input, ctx, audit }) => {
    const c = await createCorrespondence(ctx, input);
    audit.record({
      entityId: c.id,
      companyId: c.companyId,
      summary: `Logged correspondence "${c.subject}" to ${c.recipient}`,
      after: { subject: c.subject, recipient: c.recipient, status: c.status },
    });
    return { id: c.id };
  },
  revalidate: () => CORRESPONDENCE_PATHS,
});

export const updateCorrespondenceAction = defineAction({
  permission: "hr.correspondence.manage",
  schema: updateCorrespondenceSchema,
  audit: { action: "UPDATE", entity: "CORRESPONDENCE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateCorrespondence(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated correspondence "${after.subject}"`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => CORRESPONDENCE_PATHS,
});

export const deleteCorrespondenceAction = defineAction({
  permission: "hr.correspondence.manage",
  schema: hrRecordIdSchema,
  audit: { action: "DELETE", entity: "CORRESPONDENCE" },
  handler: async ({ input, ctx, audit }) => {
    const c = await deleteCorrespondence(ctx, input.id);
    audit.record({
      entityId: c.id,
      companyId: c.companyId,
      summary: `Deleted correspondence "${c.subject}"`,
    });
    return { id: c.id };
  },
  revalidate: () => CORRESPONDENCE_PATHS,
});

// --- Increments --------------------------------------------------------------

export const createIncrementAction = defineAction({
  permission: "hr.increments.manage",
  schema: incrementSchema,
  audit: { action: "CREATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const i = await createIncrement(ctx, input);
    audit.record({
      entityId: i.id,
      companyId: i.companyId,
      // The figures are recorded because an increment IS its numbers; the
      // audit reader needs them to answer "who approved what".
      summary: `Requested ${i.percentage.toString()}% increment for ${i.employeeName}, effective ${i.effectiveDate.toISOString().slice(0, 10)}`,
      after: {
        amount: i.amount.toString(),
        percentage: i.percentage.toString(),
        newSalary: i.newSalary.toString(),
      },
    });
    return { id: i.id };
  },
  revalidate: () => INCREMENT_PATHS,
});

export const updateIncrementAction = defineAction({
  permission: "hr.increments.manage",
  schema: updateIncrementSchema,
  audit: { action: "UPDATE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, employeeName, companyId } = await updateIncrement(ctx, input);
    audit.record({
      entityId: after.id,
      companyId,
      summary: `Updated pending increment for ${employeeName}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => INCREMENT_PATHS,
});

/** Approval is its own permission — the service also refuses self-approval. */
export const decideIncrementAction = defineAction({
  permission: "hr.increments.approve",
  schema: decideIncrementSchema,
  audit: { action: "APPROVE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const r = await decideIncrement(ctx, input);
    audit.record({
      entityId: r.id,
      companyId: r.companyId,
      summary:
        input.decision === "APPROVED"
          ? `Approved increment for ${r.employeeName} — contract salary ${r.previousSalary ?? "?"} → ${r.newSalary} ${r.currency}`
          : `Rejected increment for ${r.employeeName}`,
      before: { status: r.before, salary: r.previousSalary },
      after: {
        status: r.after,
        salary: r.contractUpdated ? r.newSalary : r.previousSalary,
        contractUpdated: r.contractUpdated,
      },
    });
    return { id: r.id };
  },
  revalidate: () => INCREMENT_PATHS,
});

export const deleteIncrementAction = defineAction({
  permission: "hr.increments.manage",
  schema: hrRecordIdSchema,
  audit: { action: "DELETE", entity: "INCREMENT" },
  handler: async ({ input, ctx, audit }) => {
    const i = await deleteIncrement(ctx, input.id);
    audit.record({
      entityId: i.id,
      companyId: i.companyId,
      summary: `Deleted increment request for ${i.employeeName}`,
    });
    return { id: i.id };
  },
  revalidate: () => INCREMENT_PATHS,
});

// --- Evaluations -------------------------------------------------------------

export const createEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: evaluationSchema,
  audit: { action: "CREATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const e = await createEvaluation(ctx, input);
    audit.record({
      entityId: e.id,
      companyId: e.companyId,
      summary: `Recorded evaluation of ${e.employeeName} by ${e.evaluatorName}${e.overallScore ? ` — score ${e.overallScore.toString()}` : ""}`,
      after: { overallScore: e.overallScore?.toString() ?? null, criteria: input.scores.length },
    });
    return { id: e.id };
  },
  revalidate: () => EVALUATION_PATHS,
});

export const updateEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: updateEvaluationSchema,
  audit: { action: "UPDATE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, employeeName, companyId } = await updateEvaluation(ctx, input);
    audit.record({
      entityId: after.id,
      companyId,
      summary: `Updated evaluation of ${employeeName}`,
      before,
      after: { overallScore: after.overallScore },
    });
    return { id: after.id };
  },
  revalidate: () => EVALUATION_PATHS,
});

export const decideEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: decideEvaluationSchema,
  audit: { action: "APPROVE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const r = await decideEvaluation(ctx, input);
    audit.record({
      entityId: r.id,
      companyId: r.companyId,
      summary: `${input.decision === "APPROVED" ? "Approved" : "Rejected"} evaluation of ${r.employeeName}${r.overallScore ? ` (score ${r.overallScore})` : ""}`,
      before: { status: r.before },
      after: { status: r.after },
    });
    return { id: r.id };
  },
  revalidate: () => EVALUATION_PATHS,
});

export const deleteEvaluationAction = defineAction({
  permission: "hr.evaluations.manage",
  schema: hrRecordIdSchema,
  audit: { action: "DELETE", entity: "EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const e = await deleteEvaluation(ctx, input.id);
    audit.record({
      entityId: e.id,
      companyId: e.companyId,
      summary: `Deleted evaluation of ${e.employeeName}`,
    });
    return { id: e.id };
  },
  revalidate: () => EVALUATION_PATHS,
});
