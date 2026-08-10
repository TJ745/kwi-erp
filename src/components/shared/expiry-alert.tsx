import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { daysUntilExpiry, formatExpiryLabel, getExpiryStatus } from "@/lib/expiry";
import { cn } from "@/lib/utils";

/**
 * Renders an expiry date consistently everywhere it appears.
 *
 * Consumes lib/expiry.ts, so the badge in a list, the alert on a dashboard, and
 * the filter in a report can never disagree about what "expiring soon" means.
 * Day arithmetic runs in the business timezone (ADR-010).
 */
export function ExpiryAlert({
  date,
  horizonDays,
  showIcon = true,
  className,
}: {
  date: Date | string | null | undefined;
  horizonDays?: number;
  showIcon?: boolean;
  className?: string;
}) {
  if (!date) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const expiry = typeof date === "string" ? new Date(date) : date;
  const status = getExpiryStatus(expiry, horizonDays === undefined ? {} : { horizonDays });
  const days = daysUntilExpiry(expiry);

  const variant = status === "EXPIRED" ? "expired" : status === "EXPIRING_SOON" ? "warning" : "valid";
  const Icon = status === "EXPIRED" ? XCircle : status === "EXPIRING_SOON" ? AlertTriangle : CheckCircle2;

  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      {showIcon ? <Icon aria-hidden="true" /> : null}
      <span>{formatExpiryLabel(expiry)}</span>
      <span className="sr-only">
        {status === "EXPIRED"
          ? `Expired ${String(Math.abs(days))} days ago`
          : `${String(days)} days remaining`}
      </span>
    </Badge>
  );
}

/** Compact variant for dense tables: just the date, coloured by status. */
export function ExpiryDate({
  date,
  horizonDays,
}: {
  date: Date | string | null | undefined;
  horizonDays?: number;
}) {
  if (!date) return <span className="text-muted-foreground">—</span>;

  const expiry = typeof date === "string" ? new Date(date) : date;
  const status = getExpiryStatus(expiry, horizonDays === undefined ? {} : { horizonDays });

  return (
    <span
      className={cn(
        "tabular-nums",
        status === "EXPIRED" && "text-status-expired font-medium",
        status === "EXPIRING_SOON" && "text-status-warning font-medium",
      )}
      title={formatExpiryLabel(expiry)}
    >
      {expiry.toISOString().slice(0, 10)}
    </span>
  );
}
