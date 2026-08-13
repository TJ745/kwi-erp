"use server";

import {
  checklistTemplateSchema,
  documentTypeSchema,
  platformIdSchema,
  updateChecklistTemplateSchema,
  updateDocumentTypeSchema,
} from "@/lib/schemas/platform";
import { defineAction } from "./define-action";
import {
  createDocumentType,
  deleteChecklistTemplate,
  deleteDocumentType,
  saveChecklistTemplate,
  updateDocumentType,
} from "@/server/services/platform";

/**
 * Platform administration actions.
 *
 * There is deliberately NO action here that writes, edits, or deletes an audit
 * entry. The trail is written by the pipeline and read by the UI; giving it a
 * mutation surface would defeat its purpose.
 */

const TYPE_PATHS = ["/settings/document-types", "/documents"];
const CHECKLIST_PATHS = ["/settings/checklists"];

// --- Document types ----------------------------------------------------------

export const createDocumentTypeAction = defineAction({
  permission: "documents.manageTypes",
  schema: documentTypeSchema,
  audit: { action: "CREATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const type = await createDocumentType(ctx, input);
    audit.record({
      entityId: type.id,
      summary: `Added document type "${type.name}" (${type.key})`,
      after: {
        key: type.key,
        name: type.name,
        appliesTo: input.appliesTo,
        requiresExpiry: input.requiresExpiry,
      },
    });
    return { id: type.id };
  },
  revalidate: () => TYPE_PATHS,
});

export const updateDocumentTypeAction = defineAction({
  permission: "documents.manageTypes",
  schema: updateDocumentTypeSchema,
  audit: { action: "UPDATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateDocumentType(ctx, input);
    audit.record({
      entityId: after.id,
      summary: `Updated document type "${after.name}"${before.isSystem ? " (system type — key unchanged)" : ""}`,
      before: {
        name: before.name,
        requiresExpiry: before.requiresExpiry,
        appliesTo: before.appliesTo,
      },
      after: {
        name: after.name,
        requiresExpiry: after.requiresExpiry,
        appliesTo: after.appliesTo,
      },
    });
    return { id: after.id };
  },
  revalidate: () => TYPE_PATHS,
});

export const deleteDocumentTypeAction = defineAction({
  permission: "documents.manageTypes",
  schema: platformIdSchema,
  audit: { action: "DELETE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const type = await deleteDocumentType(ctx, input.id);
    audit.record({
      entityId: type.id,
      summary: `Deleted document type "${type.name}"`,
    });
    return { id: type.id };
  },
  revalidate: () => TYPE_PATHS,
});

// --- Checklist templates -----------------------------------------------------

export const createChecklistTemplateAction = defineAction({
  permission: "settings.manage",
  schema: checklistTemplateSchema,
  audit: { action: "CREATE", entity: "CHECKLIST_INSTANCE" },
  handler: async ({ input, ctx, audit }) => {
    const { template } = await saveChecklistTemplate(ctx, input);
    audit.record({
      entityId: template.id,
      ...(template.companyId ? { companyId: template.companyId } : {}),
      summary: `Created ${input.type.toLowerCase()} checklist "${template.name}" with ${String(input.items.length)} item(s)`,
      after: { key: template.key, name: template.name, items: input.items.length },
    });
    return { id: template.id };
  },
  revalidate: () => CHECKLIST_PATHS,
});

export const updateChecklistTemplateAction = defineAction({
  permission: "settings.manage",
  schema: updateChecklistTemplateSchema,
  audit: { action: "UPDATE", entity: "CHECKLIST_INSTANCE" },
  handler: async ({ input, ctx, audit }) => {
    const { template, before } = await saveChecklistTemplate(ctx, input);
    audit.record({
      entityId: template.id,
      ...(template.companyId ? { companyId: template.companyId } : {}),
      // The instance count matters here: editing a template that has been used
      // does not touch those instances, and the trail should say so.
      summary: `Updated checklist "${template.name}" — ${String(before?.items ?? 0)} → ${String(input.items.length)} item(s)${before && before.instances > 0 ? `; ${String(before.instances)} existing checklist(s) unaffected` : ""}`,
      ...(before ? { before: { name: before.name, items: before.items } } : {}),
      after: { name: template.name, items: input.items.length },
    });
    return { id: template.id };
  },
  revalidate: () => CHECKLIST_PATHS,
});

export const deleteChecklistTemplateAction = defineAction({
  permission: "settings.manage",
  schema: platformIdSchema,
  audit: { action: "DELETE", entity: "CHECKLIST_INSTANCE" },
  handler: async ({ input, ctx, audit }) => {
    const template = await deleteChecklistTemplate(ctx, input.id);
    audit.record({
      entityId: template.id,
      ...(template.companyId ? { companyId: template.companyId } : {}),
      summary: `Deleted checklist template "${template.name}"`,
    });
    return { id: template.id };
  },
  revalidate: () => CHECKLIST_PATHS,
});
