import "server-only";
import { Prisma } from "@/generated/prisma/client";

/**
 * Models carrying a `deletedAt` column. Soft delete is applied SELECTIVELY —
 * universal soft delete breaks unique constraints and hides bugs.
 * See docs/DATABASE.md §8.
 */
export const SOFT_DELETE_MODELS = [
  "User",
  "Company",
  "Employee",
  "Document",
  "Contract",
  "Credential",
  "Vehicle",
  "ITAsset",
  "Supplier",
  "Subcontractor",
  "LetterTemplate",
] as const;

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

const softDeleteModelSet = new Set<string>(SOFT_DELETE_MODELS);

/**
 * Excludes soft-deleted rows from ordinary reads.
 *
 * Escape hatch: pass `deletedAt` explicitly in the where clause (for example
 * `{ deletedAt: { not: null } }` for a recycle-bin view, or `{}` via
 * `findMany({ where: { deletedAt: undefined } })`) and the filter defers to it.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: "softDelete",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !softDeleteModelSet.has(model)) {
          return query(args);
        }

        const readOperations = ["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate"];

        if (!readOperations.includes(operation)) {
          return query(args);
        }

        const typedArgs = args as { where?: Record<string, unknown> };
        const where = typedArgs.where ?? {};

        // Caller has spoken about deletedAt — respect their intent.
        if ("deletedAt" in where) {
          return query(args);
        }

        return query({ ...typedArgs, where: { ...where, deletedAt: null } });
      },
    },
  },
});
