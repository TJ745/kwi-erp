import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listTimesheet } from "@/server/services/hiring";
import { employeeOptions } from "@/server/services/hr-records";
import { TimesheetFilters } from "./timesheet-filters";
import { TimesheetDialog } from "./timesheet-dialog";
import { TimesheetRowActions } from "./timesheet-row-actions";
import { ApprovePeriodButton } from "./approve-period-button";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Timesheet" };

/** Defaults to the current month — the period people actually work in. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; from?: string; to?: string }>;
}) {
  const ctx = await requirePagePermission("hr.timesheet.view");
  const params = await searchParams;
  const range = defaultRange();
  const from = params.from ?? range.from;
  const to = params.to ?? range.to;

  const canManage = ctx.permissions.has("hr.timesheet.manage");
  const canApprove = ctx.permissions.has("hr.timesheet.approve");

  const [{ entries, summary }, employees] = await Promise.all([
    listTimesheet(ctx, {
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T23:59:59.999Z`),
    }),
    employeeOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Timesheet"
        description="Hours per person per day — one entry each, enforced by the database. Only approved days count towards the totals payroll would act on."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="timesheet-summary" ctx={ctx} />
            {canManage ? (
              <TimesheetDialog
                employees={employees}
                defaultDate={new Date().toISOString().slice(0, 10)}
              />
            ) : null}
          </div>
        }
      />

      <TimesheetFilters
        employees={employees}
        current={{
          employeeId: params.employeeId ?? "",
          from,
          to,
        }}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Days recorded" value={String(summary.daysRecorded)} />
        <StatCard label="Normal hours" value={summary.normalHours.toFixed(2)} />
        <StatCard label="Overtime" value={summary.overtimeHours.toFixed(2)} />
        <StatCard
          label="Delayed hours"
          value={summary.delayedHours.toFixed(2)}
          tone={summary.delayedHours > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Pending approval"
          value={summary.pendingHours.toFixed(2)}
          tone={summary.pendingHours > 0 ? "warning" : "neutral"}
        />
      </div>

      {canApprove && params.employeeId && summary.pendingHours > 0 ? (
        <ApprovePeriodButton employeeId={params.employeeId} from={from} to={to} />
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No entries in this period"
          description="Adjust the dates, or record a day's hours."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-right font-medium">Normal</th>
                <th className="px-3 py-2 text-right font-medium">Overtime</th>
                <th className="px-3 py-2 text-right font-medium">Delayed</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage || canApprove ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums">
                    {e.date.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{e.employee.fullName}</p>
                    <p className="text-muted-foreground text-xs">
                      {e.employee.employeeNo} · {e.employee.company.code}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {e.absent ? (
                      <Badge variant="outline">Absent</Badge>
                    ) : (
                      e.normalHours.toString()
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {e.overtimeHours.toString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span
                      className={
                        Number(e.delayedHours) > 0 ? "text-status-warning" : undefined
                      }
                    >
                      {e.delayedHours.toString()}
                    </span>
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
                  {canManage || canApprove ? (
                    <td className="px-3 py-2">
                      <TimesheetRowActions
                        entry={{
                          id: e.id,
                          employeeId: e.employeeId,
                          date: e.date.toISOString().slice(0, 10),
                          normalHours: e.normalHours.toString(),
                          overtimeHours: e.overtimeHours.toString(),
                          delayedHours: e.delayedHours.toString(),
                          absent: e.absent,
                          notes: e.notes,
                          status: e.status,
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

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "warning" && "text-status-warning",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
