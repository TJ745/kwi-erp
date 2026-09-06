import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { buildQueryString, parseListQuery, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { requirePageAnyPermission } from "@/server/auth/page-guards";
import {
  leaveCounts,
  leaveTypes,
  listLeaveRequests,
  type LeaveListRow,
} from "@/server/services/leave";
import { listEmployees } from "@/server/services/employees";
import { LeaveDecision } from "./leave-decision";
import { LeaveRequestButton } from "./leave-request-form";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageAnyPermission(["hr.leave.view", "hr.leave.request"]);
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = { status: typeof params.status === "string" ? params.status : undefined };

  const canApprove = ctx.permissions.has("hr.leave.approve");
  const canRequestForOthers = ctx.permissions.has("hr.leave.view");

  const [data, counts, types, employees] = await Promise.all([
    listLeaveRequests(ctx, query, filters),
    leaveCounts(ctx),
    leaveTypes(),
    canRequestForOthers
      ? listEmployees(ctx, { page: 1, pageSize: 100, q: undefined, sort: undefined })
      : Promise.resolve(null),
  ]);

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
        <span className="text-sm tabular-nums">
          {row.startDate.toISOString().slice(0, 10)} → {row.endDate.toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      cell: (row) => <span className="text-sm tabular-nums">{row.days}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <LeaveDecision
          request={{
            id: row.id,
            employeeName: row.employeeName,
            status: row.status,
            days: row.days,
          }}
          canApprove={canApprove}
          canCancel={ctx.permissions.has("hr.leave.request")}
        />
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Leave"
        description={
          ctx.permissions.has("hr.leave.view")
            ? "All leave requests in your companies."
            : "Your leave requests."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="leave-register" ctx={ctx} />
            <LeaveRequestButton
              leaveTypes={types}
              employees={employees?.rows.map((e) => ({ id: e.id, label: `${e.fullName} (${e.employeeNo})` })) ?? []}
              ownEmployeeId={ctx.employeeId}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <CountCard
          label="Awaiting decision"
          value={counts.pending}
          tone="warning"
          href={`/people/leave${buildQueryString({}, { status: "PENDING" })}`}
        />
        <CountCard
          label="Approved & upcoming"
          value={counts.approvedUpcoming}
          href={`/people/leave${buildQueryString({}, { status: "APPROVED" })}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by employee…" />
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
          <FilterChip
            key={status}
            label={status.charAt(0) + status.slice(1).toLowerCase()}
            href={`/people/leave${buildQueryString({}, { status })}`}
            active={filters.status === status}
          />
        ))}
        <FilterChip label="All" href="/people/leave" active={!filters.status} />
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/people/leave"
        caption="Leave requests"
        emptyState={
          <EmptyState
            icon={CalendarDays}
            title="No leave requests"
            description="Requests appear here once submitted, with their approval status."
          />
        }
      />
    </PageShell>
  );
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

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "hover:bg-accent text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}
