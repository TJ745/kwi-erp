"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import { policySchema, providerSchema, updatePolicySchema } from "@/lib/schemas/insurance";
import {
  createPolicy,
  createProvider,
  setPolicyWorking,
  updatePolicy,
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
