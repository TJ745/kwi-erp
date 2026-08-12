"use server";

import {
  createTemplateSchema,
  generateLetterSchema,
  letterIdSchema,
  setLetterStatusSchema,
  updateTemplateSchema,
} from "@/lib/schemas/letters";
import { defineAction } from "./define-action";
import {
  deleteTemplate,
  generateLetter,
  previewLetter,
  setLetterStatus,
  upsertTemplate,
} from "@/server/services/letters";

/**
 * Create and update are separate actions rather than one upsert because the
 * pipeline fixes the audit action per action — an edit must not be recorded as
 * a creation.
 */
export const createTemplateAction = defineAction({
  permission: "letters.manageTemplates",
  schema: createTemplateSchema,
  audit: { action: "CREATE", entity: "LETTER_TEMPLATE" },
  handler: async ({ input, ctx, audit }) => {
    const { template } = await upsertTemplate(ctx, input);
    audit.record({
      entityId: template.id,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      summary: `Created letter template "${template.name}"`,
      // The body is deliberately not recorded: it is up to 50 KB of HTML, and
      // the version number is what makes a change traceable.
      after: { key: template.key, name: template.name, version: template.version },
    });
    return { id: template.id };
  },
  revalidate: () => ["/hr/letters", "/settings/templates"],
});

export const updateTemplateAction = defineAction({
  permission: "letters.manageTemplates",
  schema: updateTemplateSchema,
  audit: { action: "UPDATE", entity: "LETTER_TEMPLATE" },
  handler: async ({ input, ctx, audit }) => {
    const { template, before } = await upsertTemplate(ctx, input);
    audit.record({
      entityId: template.id,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      summary: `Edited letter template "${template.name}" (v${String(before?.version ?? 1)} → v${String(template.version)})`,
      ...(before ? { before: { name: before.name, version: before.version } } : {}),
      after: { key: template.key, name: template.name, version: template.version },
    });
    return { id: template.id };
  },
  revalidate: () => ["/hr/letters", "/settings/templates"],
});

export const deleteTemplateAction = defineAction({
  permission: "letters.manageTemplates",
  schema: letterIdSchema,
  audit: { action: "DELETE", entity: "LETTER_TEMPLATE" },
  handler: async ({ input, ctx, audit }) => {
    const template = await deleteTemplate(ctx, input.id);
    audit.record({
      entityId: template.id,
      summary: `Deleted letter template "${template.name}"`,
    });
    return { id: template.id };
  },
  revalidate: () => ["/hr/letters", "/settings/templates"],
});

/**
 * Preview is a read, but it is an action rather than a page load because the
 * operator picks the employee interactively. It writes nothing and takes no
 * letter number — a discarded preview must not burn a sequence value.
 */
export const previewLetterAction = defineAction({
  permission: "letters.generate",
  schema: generateLetterSchema,
  handler: async ({ input, ctx }) => previewLetter(ctx, input),
});

export const generateLetterAction = defineAction({
  permission: "letters.generate",
  schema: generateLetterSchema,
  audit: { action: "CREATE", entity: "GENERATED_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const letter = await generateLetter(ctx, input);

    audit.record({
      entityId: letter.id,
      companyId: letter.companyId,
      summary: `Generated ${letter.letterNo} (${letter.templateName}) for ${letter.employeeName}`,
      // The rendered body can contain salary figures, so only the metadata is
      // recorded — docs/SECURITY.md §7.
      after: { letterNo: letter.letterNo, template: letter.templateName },
    });

    return { id: letter.id, letterNo: letter.letterNo, missing: letter.missing };
  },
  revalidate: () => ["/hr/letters"],
});

export const setLetterStatusAction = defineAction({
  permission: "letters.generate",
  schema: setLetterStatusSchema,
  audit: { action: "UPDATE", entity: "GENERATED_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setLetterStatus(ctx, input);
    audit.record({
      entityId: result.id,
      companyId: result.companyId,
      summary: `Letter ${result.letterNo} marked ${result.after.toLowerCase()}`,
      before: { status: result.before },
      after: { status: result.after },
    });
    return { id: result.id };
  },
  revalidate: () => ["/hr/letters"],
});
