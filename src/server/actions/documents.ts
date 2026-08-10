"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import { createDocument, deleteDocument } from "@/server/services/documents";

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

export const createDocumentAction = defineAction({
  permission: "documents.upload",
  schema: z
    .object({
      fileId: z.string().min(1),
      documentTypeId: z.string().min(1, "Select a document type"),
      entityType: z.enum(["EMPLOYEE", "COMPANY", "VEHICLE", "IT_ASSET"]),
      entityId: z.string().min(1),
      companyId: z.string().min(1),
      title: z.string().trim().min(2, "Title is required").max(200),
      documentNo: z.string().trim().max(80).optional(),
      issueDate: optionalDate,
      expiryDate: optionalDate,
      issuedBy: z.string().trim().max(150).optional(),
      notes: z.string().trim().max(1000).optional(),
      supersedesId: z.string().optional(),
    })
    .strict()
    .refine(
      (d) =>
        !d.issueDate || !d.expiryDate || d.expiryDate.getTime() >= d.issueDate.getTime(),
      { message: "Expiry cannot precede the issue date", path: ["expiryDate"] },
    ),
  audit: { action: "UPLOAD", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const document = await createDocument(ctx, input);
    audit.record({
      entityId: input.entityId,
      companyId: input.companyId,
      summary: `Uploaded document "${document.title}"${
        document.expiryDate
          ? ` (expires ${document.expiryDate.toISOString().slice(0, 10)})`
          : ""
      }`,
      after: { title: document.title, expiryDate: document.expiryDate },
    });
    return { id: document.id };
  },
  revalidate: (input) => [
    "/documents",
    "/dashboard",
    ...(input.entityType === "EMPLOYEE" ? [`/people/employees/${input.entityId}`] : []),
  ],
});

export const deleteDocumentAction = defineAction({
  permission: "documents.delete",
  schema: z.object({ id: z.string().min(1) }).strict(),
  audit: { action: "DELETE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const document = await deleteDocument(ctx, input.id);
    audit.record({
      entityId: document.entityId,
      companyId: document.companyId,
      summary: `Deleted document "${document.title}"; stored file destroyed`,
      before: { title: document.title },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/documents", "/dashboard"],
});
