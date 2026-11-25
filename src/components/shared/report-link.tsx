import Link from "next/link";
import { FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { REPORTS, type ReportId } from "@/lib/reports";
import type { ActorContext } from "@/server/auth/context";

/**
 * Sends a module's list to its printable report.
 *
 * Deliberately a link rather than a print button on the list itself. A list
 * page is paginated at ten rows and carries per-row action menus, so printing
 * it hands a manager "page 1 of 12" decorated with buttons that do nothing on
 * paper. The report is the same data unpaginated, with a print-only provenance
 * header — who ran it, when, under which filters — which is what stops a
 * printout being quoted as current a month later.
 *
 * Hidden rather than disabled when the viewer lacks either permission: a
 * control that only ever refuses is worse than no control.
 */
export function ReportLink({
  reportId,
  ctx,
}: {
  reportId: ReportId;
  ctx: ActorContext;
}) {
  const spec = REPORTS[reportId];

  // Both gates, matching runReport — offering a link that the report itself
  // would refuse just moves the rejection one click later.
  if (!ctx.permissions.has("reports.view")) return null;
  if (!ctx.permissions.has(spec.permission)) return null;

  return (
    <Link
      href={`/reports/${reportId}`}
      target="_blank"
      rel="noopener"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <FileText />
      Print / Report
    </Link>
  );
}
