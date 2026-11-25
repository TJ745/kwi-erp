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
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-3xl text-sm text-pretty print:hidden">
            {description}
          </p>
        ) : null}
        {printable ? (
          <p className="hidden text-xs print:block">Printed {printedOn()}</p>
        ) : null}
      </div>
      {action || printable ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
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
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 print:max-w-none print:p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
