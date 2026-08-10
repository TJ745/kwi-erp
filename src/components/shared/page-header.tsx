import { cn } from "@/lib/utils";

/** Consistent page heading. Every module page uses this rather than its own
 *  ad-hoc <h1> block, so spacing and hierarchy stay uniform. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
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
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
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
