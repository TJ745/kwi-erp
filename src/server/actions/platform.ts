"use server";

import {
  documentTypeSchema,
  platformIdSchema,
  updateDocumentTypeSchema,
} from "@/lib/schemas/platform";
import { defineAction } from "./define-action";
import {
  createDocumentType,
  deleteDocumentType,
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
