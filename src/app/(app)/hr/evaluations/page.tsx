import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { employeeOptions, listEvaluations } from "@/server/services/hr-records";
import { EvaluationDialog } from "./evaluation-dialog";
import { EvaluationRowActions } from "./evaluation-row-actions";

export const metadata: Metadata = { title: "Evaluations" };

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requirePagePermission("hr.evaluations.view");
  const { status } = await searchParams;
  const canManage = ctx.permissions.has("hr.evaluations.manage");

  const [evaluations, employees] = await Promise.all([
    listEvaluations(ctx, { ...(status ? { status } : {}) }),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Evaluations"
        description="Performance reviews. The overall score is a weighted average of the criteria, computed on the server — it cannot disagree with the scores it came from."
        action={canManage ? <EvaluationDialog employees={employees} /> : null}
      />

      {evaluations.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No evaluations"
          description="Recorded performance reviews appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Evaluator</th>
                <th className="px-3 py-2 text-left font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Criteria</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{e.employee.fullName}</p>
                    <p className="text-muted-foreground text-xs">
                      {e.employee.employeeNo} · {e.employee.company.code}
                    </p>
                  </td>
                  <td className="px-3 py-2">{e.evaluator.fullName}</td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {e.periodStart.toISOString().slice(0, 10)} →{" "}
                    {e.periodEnd.toISOString().slice(0, 10)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                    {e._count.scores}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.overallScore ? (
                      <span className="font-medium tabular-nums">
                        {e.overallScore.toString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        e.status === "APPROVED"
                          ? "default"
                          : e.status === "REJECTED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {e.status}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <EvaluationRowActions
                        evaluationId={e.id}
                        status={e.status}
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
