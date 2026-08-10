import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildQueryString, type Paginated, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Link-based pagination so it works in Server Components with no client JS. */
export function TablePagination<TRow>({
  data,
  basePath,
  searchParams,
}: {
  data: Paginated<TRow>;
  basePath: string;
  searchParams: SearchParams;
}) {
  if (data.pageCount <= 1) {
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {data.total} {data.total === 1 ? "record" : "records"}
      </p>
    );
  }

  const from = (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);
  const hasPrev = data.page > 1;
  const hasNext = data.page < data.pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Showing <span className="tabular-nums">{from}</span>–
        <span className="tabular-nums">{to}</span> of{" "}
        <span className="tabular-nums">{data.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <PageLink
          href={`${basePath}${buildQueryString(searchParams, { page: data.page - 1 })}`}
          disabled={!hasPrev}
          label="Previous page"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </PageLink>

        <span className="text-sm tabular-nums">
          Page {data.page} of {data.pageCount}
        </span>

        <PageLink
          href={`${basePath}${buildQueryString(searchParams, { page: data.page + 1 })}`}
          disabled={!hasNext}
          label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1");

  // A disabled control must not be a link — otherwise it stays focusable and
  // navigable by keyboard despite appearing inert.
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
