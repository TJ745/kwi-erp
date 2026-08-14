import { PageShell } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CardLoadingState } from "@/components/shared/states";

/**
 * Route-level loading state for every page in the app shell.
 *
 * Pages that stream their own sections with Suspense (the dashboard) never
 * reach this — Next uses the nearest boundary. This covers the rest, which
 * previously showed the previous page frozen until the server responded, with
 * no sign that anything was happening.
 *
 * Deliberately generic: a skeleton that mimics one specific page would be
 * wrong on every other one.
 */
export default function Loading() {
  return (
    <PageShell>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <CardLoadingState count={4} />

      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading
      </span>
    </PageShell>
  );
}
