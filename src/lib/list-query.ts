import { z } from "zod";

/**
 * Shared parser for server-driven list views.
 *
 * Page, sort, filter, and search live in the URL so every list is shareable and
 * bookmarkable, and so thousands of rows never reach the browser
 * (docs/ARCHITECTURE.md §7). This is the one place those params are parsed, so
 * a malformed `?page=-5&pageSize=99999` cannot reach a query.
 */

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(200).optional().catch(undefined),
  /** "field.asc" | "field.desc" */
  sort: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_.]*\.(asc|desc)$/)
    .optional()
    .catch(undefined),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export type SearchParams = Record<string, string | string[] | undefined>;

export function parseListQuery(searchParams: SearchParams): ListQuery {
  return listQuerySchema.parse({
    page: first(searchParams.page),
    pageSize: first(searchParams.pageSize),
    q: first(searchParams.q),
    sort: first(searchParams.sort),
  });
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turns "field.asc" into a Prisma orderBy, restricted to an explicit allowlist.
 *
 * The allowlist matters: passing an arbitrary column name straight through
 * would let a caller sort by — and so probe the ordering of — fields they are
 * not permitted to read.
 */
export function parseSort<TField extends string>(
  sort: string | undefined,
  allowed: readonly TField[],
  fallback: { field: TField; direction: "asc" | "desc" },
): { field: TField; direction: "asc" | "desc" } {
  if (!sort) return fallback;

  const separator = sort.lastIndexOf(".");
  const field = sort.slice(0, separator);
  const direction = sort.slice(separator + 1);

  if (!allowed.includes(field as TField)) return fallback;
  if (direction !== "asc" && direction !== "desc") return fallback;

  return { field: field as TField, direction };
}

export function paginationFor(query: ListQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function paginate<T>(rows: T[], total: number, query: ListQuery): Paginated<T> {
  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Builds a URL preserving existing params — used by pagination and sort links. */
export function buildQueryString(
  current: SearchParams,
  changes: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") params.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
