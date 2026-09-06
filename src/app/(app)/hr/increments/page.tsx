import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { employeeOptions, listIncrements } from "@/server/services/hr-records";
import { IncrementDialog } from "./increment-dialog";
import { IncrementRowActions } from "./increment-row-actions";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Increments" };

export default async function IncrementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requirePagePermission("hr.increments.view");
  const { status } = await searchParams;

  const canManage = ctx.permissions.has("hr.increments.manage");
  const canApprove = ctx.permissions.has("hr.increments.approve");
  // An increment IS salary data. Without employees.salary.view the workflow
  // stays usable but the figures are withheld — the same rule the reports
  // layer applies, for the same reason.
  const canSeeFigures = ctx.permissions.has("employees.salary.view");

  const [increments, employees] = await Promise.all([
    listIncrements(ctx, { ...(status ? { status } : {}) }),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Increments"
        description="Salary increases. The amount and percentage are derived from the two salaries, and approving one updates the employee's active contract."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="increment-register" ctx={ctx} />
            {canManage ? <IncrementDialog employees={employees} /> : null}
          </div>
        }
      />

      {!canSeeFigures ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          Salary figures are hidden because your role does not include
          <code className="mx-1">employees.salary.view</code>.
        </p>
      ) : null}

      {increments.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No increments"
          description="Requested increases appear here for approval."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                {canSeeFigures ? (
                  <>
                    <th className="px-3 py-2 text-right font-medium">Current</th>
                    <th className="px-3 py-2 text-right font-medium">New</th>
                    <th className="px-3 py-2 text-right font-medium">Increase</th>
                  </>
                ) : null}
                <th className="px-3 py-2 text-left font-medium">Effective</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage || canApprove ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {increments.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{i.employee.fullName}</p>
                    <p className="text-muted-foreground text-xs">
                      {i.employee.employeeNo} · {i.employee.company.code}
                    </p>
                  </td>

                  {canSeeFigures ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {i.currentSalary}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {i.newSalary}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={Number(i.amount) < 0 ? "text-status-expired" : ""}>
                          {Number(i.amount) >= 0 ? "+" : ""}
                          {i.amount}
                        </span>
                        <p className="text-muted-foreground text-xs">{i.percentage}%</p>
                      </td>
                    </>
                  ) : null}

                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {i.effectiveDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        i.status === "APPROVED"
                          ? "default"
                          : i.status === "REJECTED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {i.status}
                    </Badge>
                  </td>

                  {canManage || canApprove ? (
                    <td className="px-3 py-2">
                      <IncrementRowActions
                        increment={{
                          id: i.id,
                          employeeId: i.employeeId,
                          employeeName: i.employee.fullName,
                          // Empty when withheld — the figures were already
                          // stripped in the service, so nothing to leak here.
                          currentSalary: i.currentSalary ?? "",
                          newSalary: i.newSalary ?? "",
                          currency: i.currency,
                          effectiveDate: i.effectiveDate.toISOString().slice(0, 10),
                          notes: i.notes,
                          status: i.status,
                          isOwnRequest: i.requestedById === ctx.userId,
                        }}
                        employees={employees}
                        canManage={canManage}
                        canApprove={canApprove}
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
