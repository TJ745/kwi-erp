"use server";

import { defineAction } from "./define-action";
import {
  checklistItemSchema,
  completeChecklistSchema,
  contractSchema,
  leaveCancelSchema,
  leaveDecisionSchema,
  leaveRequestSchema,
  startChecklistSchema,
  updateContractSchema,
} from "@/lib/schemas/hr";
import { createContract, updateContract } from "@/server/services/contracts";
import {
  cancelLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
} from "@/server/services/leave";
import {
  completeChecklist,
  setChecklistItemStatus,
  startChecklist,
} from "@/server/services/checklists";

// --- Contracts ---------------------------------------------------------------

export const createContractAction = defineAction({
  permission: "hr.contracts.manage",
  schema: contractSchema,
  audit: { action: "CREATE", entity: "CONTRACT" },
  handler: async ({ input, ctx, audit }) => {
    const contract = await createContract(ctx, input);
    audit.record({
      entityId: contract.id,
      companyId: contract.companyId,
      // Salary is deliberately absent from the summary — the audit log is
      // widely readable and the redaction list covers the diff, not this text.
      summary: `Created ${input.contractType} contract for ${contract.employeeName}`,
      after: {
        contractType: input.contractType,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        status: input.status,
      },
    });
    return { id: contract.id };
  },
  revalidate: (input) => [
    "/hr/contracts",
    `/people/employees/${input.employeeId}`,
    "/dashboard",
  ],
});

export const updateContractAction = defineAction({
  permission: "hr.contracts.manage",
  schema: updateContractSchema,
  audit: { action: "UPDATE", entity: "CONTRACT" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateContract(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated contract for ${before.employee.fullName}`,
      before: {
        contractType: before.contractType,
        endDate: before.endDate,
        status: before.status,
      },
      after: {
        contractType: input.contractType,
        endDate: after.endDate,
        status: after.status,
      },
    });
    return { id: after.id };
  },
  revalidate: (input) => [
    "/hr/contracts",
    `/people/employees/${input.employeeId}`,
    "/dashboard",
  ],
});

// --- Leave -------------------------------------------------------------------

export const createLeaveRequestAction = defineAction({
  // Anyone may request; requesting for someone else is checked in the service.
  permission: "hr.leave.request",
  schema: leaveRequestSchema,
  audit: { action: "CREATE", entity: "LEAVE_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const request = await createLeaveRequest(ctx, input);
    audit.record({
      entityId: request.id,
      companyId: request.companyId,
      summary: `Leave requested for ${request.employeeName}: ${request.leaveTypeName}, ${String(request.days)} day(s)`,
      after: {
        startDate: input.startDate,
        endDate: input.endDate,
        days: request.days.toString(),
        status: "PENDING",
      },
    });
    return { id: request.id };
  },
  revalidate: () => ["/people/leave", "/dashboard"],
});

export const decideLeaveRequestAction = defineAction({
  permission: "hr.leave.approve",
  schema: leaveDecisionSchema,
  audit: { action: "APPROVE", entity: "LEAVE_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const result = await decideLeaveRequest(ctx, input);
    audit.record({
      entityId: input.id,
      companyId: result.companyId,
      summary: `Leave for ${result.employeeName} ${input.decision.toLowerCase()}${
        input.comment ? `: ${input.comment}` : ""
      }`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/people/leave", "/dashboard"],
});

export const cancelLeaveRequestAction = defineAction({
  permission: "hr.leave.request",
  schema: leaveCancelSchema,
  audit: { action: "UPDATE", entity: "LEAVE_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const result = await cancelLeaveRequest(ctx, input.id);
    audit.record({
      entityId: input.id,
      companyId: result.companyId,
      summary: `Leave for ${result.employeeName} cancelled`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/people/leave", "/dashboard"],
});

// --- Checklists --------------------------------------------------------------

export const startChecklistAction = defineAction({
  permission: "hr.onboarding.manage",
  schema: startChecklistSchema,
  audit: { action: "CREATE", entity: "CHECKLIST_INSTANCE" },
  handler: async ({ input, ctx, audit }) => {
    const instance = await startChecklist(ctx, input);
    audit.record({
      entityId: instance.id,
      summary: `Started ${instance.type.toLowerCase()} checklist "${instance.templateName}" for ${instance.employeeName}`,
    });
    return { id: instance.id, type: instance.type };
  },
  revalidate: (input) => [
    "/people/onboarding",
    "/people/offboarding",
    `/people/employees/${input.employeeId}`,
  ],
});

export const setChecklistItemStatusAction = defineAction({
  permission: "hr.onboarding.manage",
  schema: checklistItemSchema,
  audit: { action: "UPDATE", entity: "CHECKLIST_ITEM" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setChecklistItemStatus(ctx, input);
    audit.record({
      entityId: input.itemId,
      companyId: result.instance.companyId,
      summary: `Checklist step "${result.label}": ${result.before.status} → ${result.after.status}`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/people/onboarding", "/people/offboarding"],
});

export const completeChecklistAction = defineAction({
  permission: "hr.onboarding.manage",
  schema: completeChecklistSchema,
  audit: { action: "COMPLETE", entity: "CHECKLIST_INSTANCE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await completeChecklist(ctx, input.instanceId);
    audit.record({
      entityId: input.instanceId,
      companyId: result.companyId,
      summary: `Completed ${result.type.toLowerCase()} for ${result.employeeName}`,
      after: { status: "COMPLETED" },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/people/onboarding", "/people/offboarding"],
});
