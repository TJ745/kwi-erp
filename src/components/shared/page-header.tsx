import { Suspense } from "react";
import { PrintListButton } from "@/components/shared/print-list-button";
import { BUSINESS_TIMEZONE } from "@/lib/expiry";
import { cn } from "@/lib/utils";

/** Consistent page heading. Every module page uses this rather than its own
 *  ad-hoc <h1> block, so spacing and hierarchy stay uniform. */
export function PageHeader({
  title,
  description,
  action,
  printable = false,
  className,
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
  /** Adds a "Print list" button beside the page's own actions. */
  printable?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm print:hidden">{description}</p>
        ) : null}
        {printable ? (
          <p className="hidden text-xs print:block">Printed {printedOn()}</p>
        ) : null}
      </div>
      {action || printable ? (
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          {printable ? (
            // useSearchParams needs a boundary; the fallback keeps the header
            // from shifting while it resolves.
            <Suspense fallback={null}>
              <PrintListButton />
            </Suspense>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}

function printedOn(): string {
  return new Date().toLocaleString("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Standard page container: consistent width, padding, and vertical rhythm. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <div className={cn("space-y-6 p-6", className)}>{children}</div>;
}
