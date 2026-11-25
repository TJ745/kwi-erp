import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { cn } from "@/lib/utils";
import {
  DAILY_TASK_STATUS_LABELS,
  readTaskFilters,
  type DailyTaskFilters,
} from "@/lib/schemas/tasks";
import { requirePagePermission } from "@/server/auth/page-guards";
import { dailyTaskCounts, listDailyTasks, taskSources } from "@/server/services/daily-tasks";
import { deleteDailyTaskAction } from "@/server/actions/daily-tasks";
import { TaskDialog } from "./task-dialog";
import { TaskDoneToggle } from "./task-done-toggle";

export const metadata: Metadata = { title: "Daily Tasks" };

const day = (d: Date) => d.toISOString().slice(0, 10);
const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear())}`;

/** A query string for the filters, with some replaced. */
function queryFor(f: DailyTaskFilters, change: Partial<DailyTaskFilters> = {}) {
  const next = { ...f, ...change };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function DailyTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePagePermission("dashboard.view");
  const filters = readTaskFilters(await searchParams);

  const [tasks, counts, sources] = await Promise.all([
    listDailyTasks(ctx, filters),
    dailyTaskCounts(ctx),
    taskSources(ctx),
  ]);
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const filtered = Boolean(filters.status || filters.from || filters.to || filters.q);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Daily Tasks"
        description="Tasks you receive, who gave them, and whether they are done. Completed tasks stay on the list, so you can show what came in and what you finished."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/tasks/export${queryFor(filters)}`} download>
                <Download />
                Excel
              </a>
            </Button>
            <TaskDialog sources={sources} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-print-hide>
        <Stat label="Pending" value={counts.pending} href="/tasks?status=PENDING" tone="warning" />
        <Stat
          label="Pending over a week"
          value={counts.overdue}
          href="/tasks?status=PENDING"
          tone="danger"
        />
        <Stat label="Received this month" value={counts.receivedThisMonth} href="/tasks" />
        <Stat
          label="Completed this month"
          value={counts.completedThisMonth}
          href="/tasks?status=COMPLETED"
          tone="good"
        />
      </div>

      {/* A plain GET form: the filters live in the URL, so the Excel download
          and the printed list are exactly what is on screen. */}
      <form className="flex flex-wrap items-end gap-3" data-print-hide>
        <div className="flex gap-1">
          {(
            [
              ["", "All"],
              ["PENDING", "Pending"],
              ["COMPLETED", "Completed"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={label}
              href={`/tasks${queryFor(filters, { status: value || undefined })}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                (filters.status ?? "") === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className="border-input block h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className="border-input block h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <label className="min-w-48 flex-1 space-y-1 text-xs">
          <span className="text-muted-foreground">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Task, person or remark…"
            className="border-input block h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          />
        </label>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Apply
        </Button>
        {filtered ? (
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href="/tasks">Clear</Link>
          </Button>
        ) : null}
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No matching tasks" : "No tasks yet"}
          description={
            filtered
              ? "Try other filters."
              : "Use New task to write down a task you received. Tick it when it is done."
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} · {done} completed ·{" "}
            {tasks.length - done} pending
            {filters.from || filters.to
              ? ` · ${filters.from ?? "…"} to ${filters.to ?? "…"}`
              : ""}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2" data-print-hide />
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Task</th>
                  <th className="px-3 py-2 text-left font-medium">Received from</th>
                  <th className="px-3 py-2 text-left font-medium">Remarks</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="w-20 px-3 py-2" data-print-hide />
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const isDone = t.status === "COMPLETED";
                  return (
                    <tr key={t.id} className="border-t align-top">
                      <td className="px-3 py-2.5" data-print-hide>
                        <TaskDoneToggle id={t.id} done={isDone} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {dmy(t.taskDate)}
                      </td>
                      <td
                        className={cn(
                          "max-w-md px-3 py-2 whitespace-pre-wrap",
                          isDone && "text-muted-foreground",
                        )}
                      >
                        {t.description}
                      </td>
                      <td className="px-3 py-2">{t.receivedFrom}</td>
                      <td className="text-muted-foreground max-w-xs px-3 py-2 whitespace-pre-wrap">
                        {t.remarks ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            isDone
                              ? "bg-status-valid-bg text-status-valid"
                              : "bg-status-warning-bg text-status-warning",
                          )}
                        >
                          {DAILY_TASK_STATUS_LABELS[t.status]}
                        </span>
                        {t.completedAt ? (
                          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                            on {dmy(t.completedAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2" data-print-hide>
                        <div className="flex justify-end gap-1">
                          <TaskDialog
                            sources={sources}
                            task={{
                              id: t.id,
                              taskDate: day(t.taskDate),
                              description: t.description,
                              receivedFrom: t.receivedFrom,
                              remarks: t.remarks,
                              status: t.status,
                            }}
                          />
                          {/* Completed work stays on record. */}
                          {isDone ? null : (
                            <DeleteRecordButton
                              id={t.id}
                              label="this pending task"
                              action={deleteDailyTaskAction}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageShell>
  );
}

function Stat({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "warning" | "danger" | "good";
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:border-foreground/20 rounded-xl border p-4 transition-colors"
    >
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          value > 0 && tone === "warning" && "text-status-warning",
          value > 0 && tone === "danger" && "text-status-expired",
          value > 0 && tone === "good" && "text-status-valid",
        )}
      >
        {value}
      </p>
    </Link>
  );
}
