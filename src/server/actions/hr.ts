"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  contractSchema,
  leaveCancelSchema,
  leaveDecisionSchema,
  leaveRequestSchema,
  updateLeaveRequestSchema,
  updateContractSchema,
} from "@/lib/schemas/hr";
import { contractDefaults, createContract, updateContract } from "@/server/services/contracts";
import {
  cancelLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
  deleteLeaveRequest,
  leaveDefaults,
  updateLeaveRequest,
} from "@/server/services/leave";

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
  revalidate: (input) => ["/hr/contracts", `/people/employees/${input.employeeId}`, "/dashboard"],
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
  revalidate: (input) => ["/hr/contracts", `/people/employees/${input.employeeId}`, "/dashboard"],
});

/**
 * What a new contract starts from, once the employee is picked on the
 * Contracts page. Read-only, so nothing is audited.
 */
export const contractDefaultsAction = defineAction({
  permission: "hr.contracts.manage",
  schema: z.object({ employeeId: z.string().min(1) }),
  handler: async ({ input, ctx }) => contractDefaults(ctx, input.employeeId),
});

// --- Leave -------------------------------------------------------------------

export const createLeaveRequestAction = defineAction({
  // Leave is recorded by HR and approved as it is entered, so recording it is
  // an HR permission — a self-service request would approve itself.
  permission: "hr.leave.view",
  schema: leaveRequestSchema,
  audit: { action: "CREATE", entity: "LEAVE_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const request = await createLeaveRequest(ctx, input);
    audit.record({
      entityId: request.id,
      companyId: request.companyId,
      summary: `Leave recorded for ${request.employeeName}: ${request.leaveTypeName}, ${String(request.days)} day(s)`,
      after: {
        startDate: input.startDate,
        endDate: input.endDate,
        days: request.days.toString(),
        status: "APPROVED",
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

/** What a new leave form starts from, once the employee is picked. */
export const leaveDefaultsAction = defineAction({
  permission: "hr.leave.view",
  schema: z.object({ employeeId: z.string().min(1) }).strict(),
  handler: async ({ input, ctx }) => leaveDefaults(ctx, input.employeeId),
});

export const updateLeaveRequestAction = defineAction({
  permission: "hr.leave.view",
  schema: updateLeaveRequestSchema,
  audit: { action: "UPDATE", entity: "LEAVE_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const r = await updateLeaveRequest(ctx, input);
    audit.record({
      entityId: r.id,
      companyId: r.companyId,
      summary: `Updated leave for ${r.employeeName}: ${input.startDate.toISOString().slice(0, 10)} to ${input.endDate.toISOString().slice(0, 10)}`,
    });
    return { id: r.id };
  },
  revalidate: (input) => ["/people/leave", `/people/employees/${input.employeeId}`],
});

export const deleteLeaveRequestAction = defineAction({
  permission: "hr.leave.view",
  schema: leaveCancelSchema,
  audit: { action: "DELETE", entity: "LEAVE_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const r = await deleteLeaveRequest(ctx, input.id);
    audit.record({
      entityId: r.id,
      companyId: r.companyId,
      summary: `Deleted leave of ${r.employeeName} (${r.dates})`,
    });
    return { id: r.id };
  },
  revalidate: () => ["/people/leave"],
});
