"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  policySchema,
  providerSchema,
  updatePolicySchema,
  endEnrolmentSchema,
  bulkEnrolmentSchema,
  enrolmentSchema,
} from "@/lib/schemas/insurance";
import {
  createPolicy,
  createProvider,
  setPolicyWorking,
  updatePolicy,
  endEnrolment,
  enrolEmployee,
  enrolEmployees,
} from "@/server/services/insurance";

export const createPolicyAction = defineAction({
  permission: "insurance.manage",
  schema: policySchema,
  audit: { action: "CREATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const policy = await createPolicy(ctx, input);
    audit.record({
      entityId: policy.id,
      companyId: policy.companyId,
      summary: `Added policy ${policy.policyNumber} with ${policy.providerName}`,
      after: {
        policyNumber: policy.policyNumber,
        expiryDate: policy.expiryDate,
        status: input.status,
      },
    });
    return { id: policy.id };
  },
  revalidate: () => ["/insurance", "/dashboard"],
});

export const updatePolicyAction = defineAction({
  permission: "insurance.manage",
  schema: updatePolicySchema,
  audit: { action: "UPDATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, providerName } = await updatePolicy(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated policy ${after.policyNumber} (${providerName})`,
      before: {
        policyNumber: before.policyNumber,
        expiryDate: before.expiryDate,
        status: before.status,
        isWorking: before.isWorking,
      },
      after: {
        policyNumber: after.policyNumber,
        expiryDate: after.expiryDate,
        status: after.status,
        isWorking: after.isWorking,
      },
    });
    return { id: after.id };
  },
  revalidate: () => ["/insurance", "/dashboard"],
});

/**
 * Separate from the full edit: "the card stopped working at the clinic" is a
 * frequent, urgent update that should not require opening a form.
 */
export const setPolicyWorkingAction = defineAction({
  permission: "insurance.manage",
  schema: z.object({ id: z.string().min(1), isWorking: z.boolean() }).strict(),
  audit: { action: "UPDATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setPolicyWorking(ctx, input);
    audit.record({
      entityId: input.id,
      companyId: result.companyId,
      summary: `Policy ${result.policyNumber} (${result.providerName}) marked ${
        input.isWorking ? "working" : "NOT working"
      }`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: () => ["/insurance", "/dashboard"],
});

export const createProviderAction = defineAction({
  permission: "insurance.manage",
  schema: providerSchema,
  audit: { action: "CREATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const provider = await createProvider(ctx, input);
    audit.record({
      entityId: provider.id,
      summary: `Added insurance provider "${provider.name}"`,
    });
    return { id: provider.id };
  },
  revalidate: () => ["/insurance"],
});

// --- Employee enrolment ------------------------------------------------------

export const enrolEmployeeAction = defineAction({
  permission: "insurance.manage",
  schema: enrolmentSchema,
  audit: { action: "CREATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const { enrolment, employee, policy } = await enrolEmployee(ctx, input);
    audit.record({
      entityId: policy.id,
      companyId: policy.companyId,
      // The member number is a claims identifier, so it stays out of a summary
      // that anyone holding audit.view can read.
      summary: `Enrolled ${employee.fullName} on policy ${policy.policyNumber}${
        enrolment.className ? ` (class ${enrolment.className})` : ""
      }`,
      after: { employee: employee.fullName, className: enrolment.className },
    });
    return { id: enrolment.id };
  },
  revalidate: (input) => ["/insurance", `/people/employees/${input.employeeId}`],
});

export const enrolEmployeesAction = defineAction({
  permission: "insurance.manage",
  schema: bulkEnrolmentSchema,
  audit: { action: "UPDATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const { policy, added, skipped } = await enrolEmployees(ctx, input);
    if (added.length > 0) {
      audit.record({
        entityId: policy.id,
        companyId: policy.companyId,
        summary:
          added.length === 1
            ? `Enrolled ${added[0]!.fullName} on policy ${policy.policyNumber}`
            : `Enrolled ${String(added.length)} employees on policy ${policy.policyNumber}`,
        after: { employees: added.map((e) => e.fullName) },
      });
    }
    return { added: added.length, skipped };
  },
  revalidate: () => ["/insurance"],
});

export const endEnrolmentAction = defineAction({
  permission: "insurance.manage",
  schema: endEnrolmentSchema,
  audit: { action: "UPDATE", entity: "MEDICAL_INSURANCE_POLICY" },
  handler: async ({ input, ctx, audit }) => {
    const enrolment = await endEnrolment(ctx, input);
    audit.record({
      entityId: enrolment.policy.id,
      companyId: enrolment.policy.companyId,
      summary: `Ended cover for ${enrolment.employee.fullName} on policy ${enrolment.policy.policyNumber} from ${input.endDate.toISOString().slice(0, 10)}`,
      before: { status: enrolment.status },
      after: { status: "EXPIRED", endDate: input.endDate },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/insurance"],
});
