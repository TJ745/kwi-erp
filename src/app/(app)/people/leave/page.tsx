import type { Metadata } from "next";
import { forPicker } from "@/lib/employee-status";
import Link from "next/link";
import { CalendarDays, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { deleteLeaveRequestAction } from "@/server/actions/hr";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { parseListQuery, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { requirePageAnyPermission } from "@/server/auth/page-guards";
import {
  leaveCounts,
  leaveTypes,
  listLeaveRequests,
  type LeaveListRow,
} from "@/server/services/leave";
import { employeeOptions } from "@/server/services/hr-records";
import { LeaveRequestButton } from "./leave-request-form";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePageAnyPermission(["hr.leave.view", "hr.leave.request"]);
  const params = await searchParams;
  const query = parseListQuery(params);

  // Leave is recorded by HR and approved as it is entered.
  const canManage = ctx.permissions.has("hr.leave.view");

  const [data, counts, types, people] = await Promise.all([
    listLeaveRequests(ctx, query),
    leaveCounts(ctx),
    leaveTypes(),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);
  const employees = forPicker(people, data.rows.map((r) => r.employeeId)).map((e) => ({
    id: e.id,
    label: `${e.fullName} (${e.employeeNo} · ${e.company.code})`,
  }));

  const columns: readonly Column<LeaveListRow>[] = [
    {
      key: "employee",
      header: "Employee",
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/people/employees/${row.employeeId}`}
            className="truncate font-medium hover:underline"
          >
            {row.employeeName}
          </Link>
          <p className="text-muted-foreground font-mono text-xs">{row.employeeNo}</p>
        </div>
      ),
    },
    {
      key: "leaveType",
      header: "Type",
      primary: true,
      cell: (row) => <span className="text-sm">{row.leaveTypeName}</span>,
    },
    {
      key: "startDate",
      header: "Dates",
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="text-sm tabular-nums">
          {row.startDate.toISOString().slice(0, 10)} → {row.endDate.toISOString().slice(0, 10)}
          {row.extendsDates ? (
            <p className="text-muted-foreground text-xs">
              Extension of {row.extendsDates.startDate.toISOString().slice(0, 10)} →{" "}
              {row.extendsDates.endDate.toISOString().slice(0, 10)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      cell: (row) => <span className="text-sm tabular-nums">{row.days}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap" data-print-hide>
          <Button asChild size="sm" variant="outline">
            <Link href={`/people/leave/${row.id}`} target="_blank" rel="noopener">
              <Printer />
              Print
            </Link>
          </Button>
          {canManage ? (
            <>
              {row.extended ? null : (
                <LeaveRequestButton leaveTypes={types} employees={employees} extend={values(row)} />
              )}
              <LeaveRequestButton leaveTypes={types} employees={employees} leave={values(row)} />
              <DeleteRecordButton
                id={row.id}
                label={`the leave of ${row.employeeName}`}
                action={deleteLeaveRequestAction}
              />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        printable
        title="Leave"
        description={
          ctx.permissions.has("hr.leave.view")
            ? "Employees' leave. Each one prints as the Leave Request form."
            : "Your leave."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="leave-register" ctx={ctx} />
            {canManage ? <LeaveRequestButton leaveTypes={types} employees={employees} /> : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3" data-print-hide>
        <CountCard label="On leave today" value={counts.onLeaveNow} href="/people/leave" />
        <CountCard label="Upcoming" value={counts.upcoming} href="/people/leave" />
      </div>

      <SearchInput placeholder="Search by employee…" />

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/people/leave"
        caption="Leave requests"
        emptyState={
          <EmptyState
            icon={CalendarDays}
            title="No leave recorded"
            description="Use New leave to record an employee's leave; it prints as the Leave Request form."
          />
        }
      />
    </PageShell>
  );
}

function values(row: LeaveListRow) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveTypeId: row.leaveTypeId,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    handoverToId: row.handoverToId,
    form: row.form,
  };
}

function CountCard({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-foreground/20 gap-0 py-4 transition-colors">
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              value > 0 && tone === "warning" && "text-status-warning",
            )}
          >
            {value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
