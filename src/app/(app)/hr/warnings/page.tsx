import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const [warnings, employees] = await Promise.all([
    listWarnings(ctx, {
      ...(level ? { level } : {}),
      ...(employeeId ? { employeeId } : {}),
    }),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Warning Letters"
        description="Disciplinary record. Once an employee acknowledges a warning it can no longer be edited or deleted — it is what they signed for."
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
                <th className="px-3 py-2 text-left font-medium">Acknowledged</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
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
                    {w.acknowledgedAt ? (
                      <span className="text-muted-foreground tabular-nums">
                        {w.acknowledgedAt.toISOString().slice(0, 10)}
                      </span>
                    ) : (
                      <Badge variant="outline">Not acknowledged</Badge>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <WarningRowActions
                        warning={{
                          id: w.id,
                          employeeId: w.employeeId,
                          level: w.level,
                          reason: w.reason,
                          description: w.description,
                          issuedDate: w.issuedDate.toISOString().slice(0, 10),
                          acknowledged: w.acknowledgedAt !== null,
                        }}
                        employees={employees}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
