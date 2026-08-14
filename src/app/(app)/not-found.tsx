import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";

/**
 * Shown for an unknown route, and for a record the actor may not see.
 *
 * The wording is deliberately the same in both cases. Services return
 * `NotFoundError` rather than `ForbiddenError` when a record is out of company
 * scope precisely so that a missing record and a barred one are
 * indistinguishable — telling someone "that exists but is not yours" confirms
 * the record exists, which is itself a disclosure.
 */
export default function NotFound() {
  return (
    <PageShell>
      <EmptyState
        icon={FileQuestion}
        title="Not found"
        description="This page does not exist, or the record is not one you have access to."
        action={
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Back to the dashboard
          </Link>
        }
      />
    </PageShell>
  );
}
