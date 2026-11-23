"use server";

import {
  createTimesheetSchema,
  saveTimesheetSchema,
  signedTimesheetSchema,
  timesheetFileIdSchema,
  timesheetFileSchema,
  timesheetRowSchema,
} from "@/lib/schemas/timesheet";
import {
  addMissingRows,
  attachSignedCopy,
  createTimesheet,
  deleteTimesheet,
  removeRow,
  saveTimesheet,
} from "@/server/services/timesheet-sheets";
import { defineAction } from "./define-action";
import { createTimesheetFile, deleteTimesheetFile } from "@/server/services/timesheets";

const TIMESHEET_PATHS = ["/people/timesheet"];

export const createTimesheetFileAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: timesheetFileSchema,
  audit: { action: "UPLOAD", entity: "TIMESHEET_FILE" },
  handler: async ({ input, ctx, audit }) => {
    const t = await createTimesheetFile(ctx, input);
    audit.record({
      entityId: t.id,
      companyId: t.companyId,
      summary: `Uploaded the ${t.companyCode} timesheet for ${t.monthLabel}`,
    });
    return { id: t.id };
  },
  revalidate: () => TIMESHEET_PATHS,
});

export const deleteTimesheetFileAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: timesheetFileIdSchema,
  audit: { action: "DELETE", entity: "TIMESHEET_FILE" },
  handler: async ({ input, ctx, audit }) => {
    const t = await deleteTimesheetFile(ctx, input.id);
    audit.record({
      entityId: t.id,
      companyId: t.companyId,
      summary: `Deleted the ${t.companyCode} timesheet for ${t.monthLabel} (${t.fileName})`,
    });
    return { id: t.id };
  },
  revalidate: () => TIMESHEET_PATHS,
});

// --- Timesheets (the attendance grid) ---------------------------------------------

const sheetPaths = (id: string) => [...TIMESHEET_PATHS, `/people/timesheet/${id}`];

export const createTimesheetAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: createTimesheetSchema,
  audit: { action: "CREATE", entity: "TIMESHEET" },
  handler: async ({ input, ctx, audit }) => {
    const t = await createTimesheet(ctx, input);
    audit.record({
      entityId: t.id,
      companyId: t.companyIds[0] ?? null,
      summary: `Created timesheet ${t.title} for ${input.month} (${String(t.rows)} employees)`,
    });
    return { id: t.id };
  },
  revalidate: () => TIMESHEET_PATHS,
});

export const saveTimesheetAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: saveTimesheetSchema,
  audit: { action: "UPDATE", entity: "TIMESHEET" },
  handler: async ({ input, ctx, audit }) => {
    const t = await saveTimesheet(ctx, input);
    audit.record({ entityId: t.id, companyId: t.companyId, summary: `Saved timesheet ${t.title}` });
    return { id: t.id };
  },
  revalidate: (input) => sheetPaths(input.id),
});

export const addMissingRowsAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: timesheetFileIdSchema,
  audit: { action: "UPDATE", entity: "TIMESHEET" },
  handler: async ({ input, ctx, audit }) => {
    const t = await addMissingRows(ctx, input.id);
    if (t.added > 0) {
      audit.record({
        entityId: t.id,
        companyId: t.companyId,
        summary: `Added ${String(t.added)} employee(s) to timesheet ${t.title}`,
      });
    }
    return { added: t.added };
  },
  revalidate: (input) => sheetPaths(input.id),
});

export const removeTimesheetRowAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: timesheetRowSchema,
  audit: { action: "UPDATE", entity: "TIMESHEET" },
  handler: async ({ input, ctx, audit }) => {
    const t = await removeRow(ctx, input);
    audit.record({
      entityId: t.id,
      companyId: t.companyId,
      summary: `Removed a row from timesheet ${t.title}`,
    });
    return { ok: true as const };
  },
  revalidate: (input) => sheetPaths(input.id),
});

export const attachSignedTimesheetAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: signedTimesheetSchema,
  audit: { action: "UPLOAD", entity: "TIMESHEET" },
  handler: async ({ input, ctx, audit }) => {
    const t = await attachSignedCopy(ctx, input);
    audit.record({
      entityId: t.id,
      companyId: t.companyId,
      summary: `Uploaded the signed copy of timesheet ${t.title}`,
    });
    return { ok: true as const };
  },
  revalidate: (input) => sheetPaths(input.id),
});

export const deleteTimesheetAction = defineAction({
  permission: "hr.timesheet.manage",
  schema: timesheetFileIdSchema,
  audit: { action: "DELETE", entity: "TIMESHEET" },
  handler: async ({ input, ctx, audit }) => {
    const t = await deleteTimesheet(ctx, input.id);
    audit.record({
      entityId: t.id,
      companyId: t.companyId,
      summary: `Deleted timesheet ${t.title}`,
    });
    return { ok: true as const };
  },
  revalidate: () => TIMESHEET_PATHS,
});
