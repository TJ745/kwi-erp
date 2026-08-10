"use client";

import { ErrorState } from "@/components/shared/states";
import { PageShell } from "@/components/shared/page-header";

/**
 * Error boundary for the authenticated shell.
 *
 * Next replaces the message with an opaque `digest` in production, so nothing
 * sensitive can leak here. The digest is shown as a reference the user can quote
 * to support, which maps to the server log entry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell>
      <ErrorState
        title="Something went wrong"
        description="The page could not be loaded. Try again, and quote the reference below if it keeps happening."
        reference={error.digest}
        retry={reset}
      />
    </PageShell>
  );
}
