"use server";

import {
  subcontractorContractSchema,
  subcontractDefaultsSchema,
  subcontractorSchema,
  updateSubcontractorContractSchema,
  updateSubcontractorSchema,
  vendorIdSchema,
} from "@/lib/schemas/vendors";
import { defineAction } from "./define-action";
import {
  createSubcontractor,
  createSubcontractorContract,
  deleteSubcontractor,
  deleteSubcontractorContract,
  updateSubcontractDefaultTerms,
  updateSubcontractor,
  updateSubcontractorContract,
} from "@/server/services/vendors";

const SUB_PATHS = ["/admin/subcontractors", "/dashboard"];

// --- Subcontractors ----------------------------------------------------------

export const createSubcontractorAction = defineAction({
  permission: "subcontractors.manage",
  schema: subcontractorSchema,
  audit: { action: "CREATE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const sub = await createSubcontractor(ctx, input);
    audit.record({
      entityId: sub.id,
      summary: `Added subcontractor ${sub.code} — ${sub.name}`,
      after: { code: sub.code, name: sub.name, crNumber: input.crNumber ?? null },
    });
    return { id: sub.id };
  },
  revalidate: () => SUB_PATHS,
});

export const updateSubcontractorAction = defineAction({
  permission: "subcontractors.manage",
  schema: updateSubcontractorSchema,
  audit: { action: "UPDATE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateSubcontractor(ctx, input);
    audit.record({
      entityId: after.id,
      summary: `Updated subcontractor ${after.code} — ${after.name}`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => SUB_PATHS,
});

export const deleteSubcontractorAction = defineAction({
  permission: "subcontractors.manage",
  schema: vendorIdSchema,
  audit: { action: "DELETE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const sub = await deleteSubcontractor(ctx, input.id);
    audit.record({
      entityId: sub.id,
      summary: `Archived subcontractor ${sub.code} — ${sub.name} (${String(sub._count.contracts)} contract(s) removed from the expiry register)`,
    });
    return { id: sub.id };
  },
  revalidate: () => SUB_PATHS,
});

// --- Contracts ---------------------------------------------------------------

export const createSubcontractorContractAction = defineAction({
  permission: "subcontractors.manage",
  schema: subcontractorContractSchema,
  audit: { action: "CREATE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const contract = await createSubcontractorContract(ctx, input);
    audit.record({
      entityId: contract.id,
      companyId: contract.companyId,
      summary: `Added contract ${contract.contractNo} for ${contract.subcontractorName}`,
      after: {
        contractNo: contract.contractNo,
        endDate: contract.endDate,
        status: contract.status,
      },
    });
    return { id: contract.id };
  },
  revalidate: () => SUB_PATHS,
});

export const updateSubcontractorContractAction = defineAction({
  permission: "subcontractors.manage",
  schema: updateSubcontractorContractSchema,
  audit: { action: "UPDATE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateSubcontractorContract(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated contract ${after.contractNo} for ${after.subcontractor.name}`,
      before: { endDate: before.endDate, status: before.status },
      after: { endDate: after.endDate, status: after.status },
    });
    return { id: after.id };
  },
  revalidate: () => SUB_PATHS,
});

export const deleteSubcontractorContractAction = defineAction({
  permission: "subcontractors.manage",
  schema: vendorIdSchema,
  audit: { action: "DELETE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const contract = await deleteSubcontractorContract(ctx, input.id);
    audit.record({
      entityId: contract.id,
      companyId: contract.companyId,
      summary: `Deleted contract ${contract.contractNo} for ${contract.subcontractor.name}`,
    });
    return { id: contract.id };
  },
  revalidate: () => SUB_PATHS,
});

// --- Default terms -------------------------------------------------------------

export const updateSubcontractDefaultTermsAction = defineAction({
  permission: "subcontractors.manage",
  schema: subcontractDefaultsSchema,
  audit: { action: "UPDATE", entity: "SUBCONTRACTOR" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateSubcontractDefaultTerms(ctx, input.terms);
    audit.record({
      entityId: "default-terms",
      summary: "Updated the default subcontract terms & conditions",
      before: { terms: before },
      after: { terms: after },
    });
    return { ok: true };
  },
  revalidate: () => SUB_PATHS,
});
