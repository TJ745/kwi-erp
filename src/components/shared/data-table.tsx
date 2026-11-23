import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildQueryString, type Paginated, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { NoResultsState } from "./states";
import { TablePagination } from "./table-pagination";

/**
 * Server-driven table — docs/MODULES.md §6.
 *
 * A Server Component: sorting and pagination are links, not client state, so
 * the browser never holds more than one page and every view is shareable.
 *
 * Responsive behaviour is a TRANSFORM, not a shrink (brief §42): below `md`
 * each row renders as a card built from the columns marked `primary`.
 */

export type Column<TRow> = {
  /** Stable key; also the sort field when `sortable` is set. */
  key: string;
  header: string;
  /** Cell renderer. Kept explicit so cells can be Server Components. */
  cell: (row: TRow) => React.ReactNode;
  sortable?: boolean;
  /** Shown in the mobile card view. Aim for 3–4 per table. */
  primary?: boolean;
  align?: "left" | "right";
  className?: string;
  headerClassName?: string;
};

export function DataTable<TRow extends { id: string }>({
  data,
  columns,
  searchParams,
  basePath,
  rowHref,
  linkColumns,
  emptyState,
  caption,
}: {
  data: Paginated<TRow>;
  columns: readonly Column<TRow>[];
  searchParams: SearchParams;
  /** Path the sort/pagination links point at. */
  basePath: string;
  /** Makes rows clickable. */
  rowHref?: ((row: TRow) => string) | undefined;
  /** Columns whose cells link to `rowHref`. Defaults to the first column. */
  linkColumns?: readonly string[];
  /** Shown when there are no rows at all (as opposed to no matches). */
  emptyState?: React.ReactNode | undefined;
  caption?: string | undefined;
}) {
  const hasFilters = Boolean(searchParams.q) || Object.keys(searchParams).length > 2;

  if (data.rows.length === 0) {
    return hasFilters ? (
      <NoResultsState
        onClear={
          <Link
            href={basePath}
            className="text-sm font-medium underline underline-offset-4"
          >
            Clear filters
          </Link>
        }
      />
    ) : (
      (emptyState ?? <NoResultsState />)
    );
  }

  const currentSort = typeof searchParams.sort === "string" ? searchParams.sort : undefined;
  const primaryColumns = columns.filter((c) => c.primary);
  const mobileColumns = primaryColumns.length > 0 ? primaryColumns : columns.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Desktop: a real table, horizontally scrollable if needed. */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === "right" && "text-right",
                    column.headerClassName,
                  )}
                >
                  {column.sortable ? (
                    <SortLink
                      column={column}
                      basePath={basePath}
                      searchParams={searchParams}
                      currentSort={currentSort}
                    />
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id} className={rowHref ? "hover:bg-muted/50" : undefined}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.align === "right" && "text-right", column.className)}
                  >
                    {rowHref && (linkColumns ?? [columns[0]?.key]).includes(column.key) ? (
                      <Link href={rowHref(row)} className="hover:underline">
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards, not a squeezed table. */}
      <ul className="space-y-3 md:hidden">
        {data.rows.map((row) => {
          const content = (
            <div className="space-y-2 rounded-lg border p-4">
              {mobileColumns.map((column, index) => (
                <div key={column.key} className="flex items-start justify-between gap-3">
                  {index === 0 ? (
                    <span className="font-medium">{column.cell(row)}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground text-xs">{column.header}</span>
                      <span className="text-right text-sm">{column.cell(row)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          );

          return (
            <li key={row.id}>
              {rowHref ? <Link href={rowHref(row)}>{content}</Link> : content}
            </li>
          );
        })}
      </ul>

      <TablePagination data={data} basePath={basePath} searchParams={searchParams} />
    </div>
  );
}

function SortLink<TRow>({
  column,
  basePath,
  searchParams,
  currentSort,
}: {
  column: Column<TRow>;
  basePath: string;
  searchParams: SearchParams;
  currentSort: string | undefined;
}) {
  const isActive = currentSort?.startsWith(`${column.key}.`) ?? false;
  const isAsc = currentSort === `${column.key}.asc`;
  const next = isActive && isAsc ? `${column.key}.desc` : `${column.key}.asc`;

  const Icon = !isActive ? ChevronsUpDown : isAsc ? ArrowUp : ArrowDown;

  return (
    <Link
      href={`${basePath}${buildQueryString(searchParams, { sort: next, page: 1 })}`}
      className="hover:text-foreground inline-flex items-center gap-1"
      aria-label={`Sort by ${column.header} ${isAsc ? "descending" : "ascending"}`}
    >
      {column.header}
      <Icon className={cn("size-3.5", isActive ? "opacity-100" : "opacity-40")} />
    </Link>
  );
}
