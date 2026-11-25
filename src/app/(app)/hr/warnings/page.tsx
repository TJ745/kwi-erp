import type { Metadata } from "next";
import { forPicker } from "@/lib/employee-status";
import Link from "next/link";
import { AlertTriangle, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { employeeOptions, listWarnings } from "@/server/services/hr-records";
import { WarningDialog } from "./warning-dialog";
import { WarningRowActions } from "./warning-row-actions";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Warning Letters" };

/** Escalation order, so the badge tone matches severity. */
const LEVEL_TONE: Record<string, "outline" | "secondary" | "destructive"> = {
  VERBAL: "outline",
  FIRST_WRITTEN: "secondary",
  SECOND_WRITTEN: "secondary",
  FINAL: "destructive",
};

export default async function WarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; employeeId?: string }>;
}) {
  const ctx = await requirePagePermission("hr.warnings.view");
  const { level, employeeId } = await searchParams;
  const canManage = ctx.permissions.has("hr.warnings.manage");

  const [warnings, everyone] = await Promise.all([
    listWarnings(ctx, {
      ...(level ? { level } : {}),
      ...(employeeId ? { employeeId } : {}),
    }),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);
  const employees = forPicker(everyone, warnings.map((w) => w.employeeId));

  return (
    <PageShell>
      <PageHeader
        printable
        title="Warning Letters"
        description="Warning letters issued to employees. Each one prints as the bilingual English / Arabic letter."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="warning-register" ctx={ctx} />
            {canManage ? <WarningDialog employees={employees} /> : null}
          </div>
        }
      />

      {warnings.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No warnings issued"
          description="Warning letters appear here once issued."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Level</th>
                <th className="px-3 py-2 text-left font-medium">Reason</th>
                <th className="px-3 py-2 text-left font-medium">Issued</th>
                <th className="w-32 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {warnings.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{w.employee.fullName}</p>
                    <p className="text-muted-foreground text-xs">
                      {w.employee.employeeNo} · {w.employee.company.code}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={LEVEL_TONE[w.level] ?? "outline"}>
                      {w.level.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="max-w-sm px-3 py-2">
                    <p className="truncate">{w.reason}</p>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {w.issuedDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/warnings/${w.id}`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
                      {canManage ? (
                        <WarningRowActions
                          warning={{
                            id: w.id,
                            employeeId: w.employeeId,
                            level: w.level,
                            reason: w.reason,
                            description: w.description,
                            descriptionAr: w.descriptionAr ?? "",
                            project: w.project,
                            issuedDate: w.issuedDate.toISOString().slice(0, 10),
                          }}
                          employees={employees}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
