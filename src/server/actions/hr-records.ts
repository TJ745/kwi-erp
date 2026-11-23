"use server";

import { hrRecordIdSchema, updateWarningSchema, warningSchema } from "@/lib/schemas/hr-records";
import { defineAction } from "./define-action";
import { createWarning, deleteWarning, updateWarning } from "@/server/services/hr-records";

const WARNING_PATHS = ["/hr/warnings"];

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

export const deleteWarningAction = defineAction({
  permission: "hr.warnings.manage",
  schema: hrRecordIdSchema,
  audit: { action: "DELETE", entity: "WARNING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const w = await deleteWarning(ctx, input.id);
    audit.record({
      entityId: w.id,
      companyId: w.companyId,
      summary: `Deleted warning for ${w.employeeName} — ${w.reason}`,
    });
    return { id: w.id };
  },
  revalidate: () => WARNING_PATHS,
});
