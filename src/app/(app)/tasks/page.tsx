import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { buildQueryString, parseListQuery, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { orgOptions } from "@/server/services/org";
import {
  assignableUsers,
  listTasks,
  taskCounts,
  type TaskListRow,
} from "@/server/services/tasks";
import { TaskCreateButton } from "./task-form";
import { TaskRowActions } from "./task-row-actions";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("tasks.view");
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = {
    status: typeof params.status === "string" ? params.status : undefined,
    priority: typeof params.priority === "string" ? params.priority : undefined,
    assignee: typeof params.assignee === "string" ? params.assignee : undefined,
    overdue: params.overdue === "1",
  };

  const [data, counts, options, users] = await Promise.all([
    listTasks(ctx, query, filters),
    taskCounts(ctx),
    orgOptions(ctx),
    ctx.permissions.has("tasks.create") ? assignableUsers(ctx) : Promise.resolve([]),
  ]);

  const canCreate = ctx.permissions.has("tasks.create");
  const canUpdate = ctx.permissions.has("tasks.update");

  const columns: readonly Column<TaskListRow>[] = [
    {
      key: "title",
      header: "Task",
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="text-muted-foreground font-mono text-xs">{row.taskNo}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: "assignee",
      header: "Assigned to",
      primary: true,
      cell: (row) => (
        <span className="text-sm">{row.assignedToName ?? "—"}</span>
      ),
    },
    {
      key: "dueDate",
      header: "Due",
      sortable: true,
      primary: true,
      cell: (row) =>
        row.dueDate ? (
          <span
            className={cn(
              "text-sm tabular-nums",
              row.isOverdue && "text-status-expired font-medium",
            )}
          >
            {row.dueDate.toISOString().slice(0, 10)}
            {row.isOverdue ? (
              <Badge variant="expired" className="ml-2">
                Overdue
              </Badge>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) =>
        canUpdate ? (
          <TaskRowActions
            task={{ id: row.id, taskNo: row.taskNo, title: row.title, status: row.status }}
            canDelete={ctx.permissions.has("tasks.delete")}
          />
        ) : null,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Tasks & Follow-ups"
        description={
          ctx.permissions.has("tasks.viewAll")
            ? "All tasks in your companies."
            : "Tasks assigned to you or created by you."
        }
        action={
          canCreate ? (
            <TaskCreateButton companies={options.companies} users={users} />
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Open" value={counts.open} href="/tasks" />
        <CountCard
          label="Overdue"
          value={counts.overdue}
          tone="expired"
          href={`/tasks${buildQueryString({}, { overdue: 1 })}`}
        />
        <CountCard label="Due today" value={counts.dueToday} tone="warning" href="/tasks" />
        <CountCard
          label="Assigned to me"
          value={counts.mine}
          href={`/tasks${buildQueryString({}, { assignee: "me" })}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search tasks…" />
        <FilterChip label="All" href="/tasks" active={!filters.status && !filters.overdue} />
        <FilterChip
          label="To do"
          href={`/tasks${buildQueryString({}, { status: "TODO" })}`}
          active={filters.status === "TODO"}
        />
        <FilterChip
          label="In progress"
          href={`/tasks${buildQueryString({}, { status: "IN_PROGRESS" })}`}
          active={filters.status === "IN_PROGRESS"}
        />
        <FilterChip
          label="Overdue"
          href={`/tasks${buildQueryString({}, { overdue: 1 })}`}
          active={filters.overdue === true}
        />
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/tasks"
        rowHref={(row) => `/tasks/${row.id}`}
        caption="Tasks and follow-ups"
        emptyState={
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Create a task to track a follow-up, a renewal, or anything that needs chasing."
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
  tone?: "neutral" | "warning" | "expired";
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-foreground/20 gap-0 py-4 transition-colors">
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              value > 0 && tone === "expired" && "text-status-expired",
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
