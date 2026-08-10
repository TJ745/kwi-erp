import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The four states every list, tab, and panel must handle
 * (docs/DEVELOPMENT.md §8). Using these instead of ad-hoc "No data" strings is
 * what keeps empty and error states from being forgotten.
 */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  // `| undefined` is required under exactOptionalPropertyTypes so callers may
  // forward a possibly-undefined value without narrowing at every call site.
  icon?: LucideIcon | undefined;
  title: string;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="text-muted-foreground size-8" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Distinct from EmptyState: filters returning nothing is not the same as
 *  having no records, and offering "clear filters" is the useful action. */
export function NoResultsState({
  onClear,
  className,
}: {
  onClear?: React.ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title="No matching records"
      description="Try adjusting your search or filters."
      action={onClear}
      className={className}
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  reference,
  retry,
  className,
}: {
  title?: string | undefined;
  description?: string | undefined;
  /** Correlation id from ActionResult — lets support find the server log. */
  reference?: string | undefined;
  retry?: (() => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-12 text-center",
        className,
      )}
    >
      <AlertCircle className="text-destructive size-8" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>
        ) : null}
        {reference ? (
          <p className="text-muted-foreground font-mono text-xs">Reference: {reference}</p>
        ) : null}
      </div>
      {retry ? (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Table-shaped skeleton, so loading does not shift layout on resolve. */
export function TableLoadingState({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex gap-4 border-b pb-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardLoadingState({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}
