import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  IdCard,
  Plane,
  UserPlus,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageShell } from "@/components/shared/page-header";
import { CardLoadingState } from "@/components/shared/states";
import { DonutChart } from "@/components/charts/donut-chart";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import type { ActorContext } from "@/server/auth/context";
import {
  headcountByDepartment,
  leaveSnapshot,
  needsAttention,
  renewalCounts,
  staffSummary,
} from "@/server/services/dashboard";
import { dailyTaskCounts, pendingTasks, taskSources } from "@/server/services/daily-tasks";
import { listExpiring } from "@/server/services/expiry";
import { TaskDialog } from "../tasks/task-dialog";
import { TaskDoneToggle } from "../tasks/task-done-toggle";

export const metadata: Metadata = { title: "Dashboard" };

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * The dashboard answers four questions, in this order: what do I have to do
 * (tasks), who is here (staff and leave), what needs renewing (expiries), and
 * what is due (deadlines). Each block streams on its own.
 */
export default async function DashboardPage() {
  const ctx = await requirePagePermission("dashboard.view");
  const sources = await taskSources(ctx);

  return (
    <PageShell>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{todayLabel()}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting(ctx.name)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ctx.permissions.has("employees.create") ? (
            <Link
              href="/people/employees/new"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <UserPlus />
              Add employee
            </Link>
          ) : null}
          <TaskDialog sources={sources} />
        </div>
      </header>

      <Suspense fallback={<CardLoadingState count={4} />}>
        <KpiRow ctx={ctx} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<CardLoadingState count={1} />}>
            <TasksCard ctx={ctx} />
          </Suspense>
        </div>
        <Suspense fallback={<CardLoadingState count={1} />}>
          <AttentionCard ctx={ctx} />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<CardLoadingState count={1} />}>
            <ExpiringCard ctx={ctx} />
          </Suspense>
        </div>
        <Suspense fallback={<CardLoadingState count={1} />}>
          <LeaveCard ctx={ctx} />
        </Suspense>
      </div>

      <Suspense fallback={<CardLoadingState count={1} />}>
        <StaffCard ctx={ctx} />
      </Suspense>
    </PageShell>
  );
}

// --- KPI row ---------------------------------------------------------------------

async function KpiRow({ ctx }: { ctx: ActorContext }) {
  const [staff, tasks, renewals, leave] = await Promise.all([
    staffSummary(ctx),
    dailyTaskCounts(ctx),
    renewalCounts(ctx),
    leaveSnapshot(ctx),
  ]);
  const onStrength = staff?.reduce((s, r) => s + r.active, 0) ?? null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        icon={ClipboardList}
        label="Pending tasks"
        value={tasks.pending}
        sub={
          tasks.overdue > 0
            ? `${String(tasks.overdue)} waiting over a week`
            : `${String(tasks.completedThisMonth)} completed this month`
        }
        href="/tasks?status=PENDING"
        tone={tasks.overdue > 0 ? "expired" : tasks.pending > 0 ? "warning" : "neutral"}
      />
      {onStrength !== null && staff ? (
        <Kpi
          icon={Users}
          label="Staff on strength"
          value={onStrength}
          sub={staff.map((r) => `${r.code} ${String(r.active)}`).join(" · ")}
          href="/people/employees?status=ACTIVE"
        />
      ) : null}
      {leave ? (
        <Kpi
          icon={Plane}
          label="On leave today"
          value={leave.away.length}
          sub={`${String(leave.soon.length)} going in the next 14 days`}
          href="/people/leave"
          tone="info"
        />
      ) : null}
      <Kpi
        icon={IdCard}
        label="Expired documents"
        value={renewals.expired}
        sub={`${String(renewals.within30)} more expire within 30 days`}
        href="/people/iqama"
        tone={renewals.expired > 0 ? "expired" : renewals.within30 > 0 ? "warning" : "neutral"}
      />
    </div>
  );
}

type Tone = "neutral" | "warning" | "expired" | "info";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  warning: "text-status-warning",
  expired: "text-status-expired",
  info: "text-status-info",
};
const TONE_CHIP: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-status-warning-bg text-status-warning",
  expired: "bg-status-expired-bg text-status-expired",
  info: "bg-status-info-bg text-status-info",
};

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tone = "neutral",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub: string;
  href: string;
  tone?: Tone;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full gap-0 py-4 transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start gap-3 px-3.5 sm:px-4">
          <span
            className={cn(
              "hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex",
              TONE_CHIP[value > 0 ? tone : "neutral"],
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">{label}</p>
            <p
              className={cn(
                "text-2xl leading-tight font-bold tracking-tight tabular-nums sm:text-3xl",
                value > 0 ? TONE_TEXT[tone] : "text-foreground",
              )}
            >
              {value}
            </p>
            <p className="text-muted-foreground line-clamp-2 text-xs sm:truncate">{sub}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// --- Tasks ----------------------------------------------------------------------

async function TasksCard({ ctx }: { ctx: ActorContext }) {
  const [tasks, counts] = await Promise.all([pendingTasks(ctx, 8), dailyTaskCounts(ctx)]);
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardList className="size-4" />
            My pending tasks
            {counts.pending > 0 ? (
              <span className="bg-status-warning-bg text-status-warning rounded-full px-2 py-0.5 text-xs tabular-nums">
                {counts.pending}
              </span>
            ) : null}
          </CardTitle>
          <Link href="/tasks" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            All tasks
            <ArrowRight />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="text-status-valid size-8" />
            <p className="text-sm font-medium">Nothing pending</p>
            <p className="text-muted-foreground text-xs">
              {counts.completedThisMonth > 0
                ? `${String(counts.completedThisMonth)} task${counts.completedThisMonth === 1 ? "" : "s"} completed this month.`
                : "Tasks you record show here until they are done."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {tasks.map((t) => {
              const late = t.late;
              return (
                <li key={t.id} className="flex items-start gap-3 py-2.5">
                  <div className="pt-0.5">
                    <TaskDoneToggle id={t.id} done={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{t.description}</p>
                    <p className="text-muted-foreground text-xs">from {t.receivedFrom}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-xs tabular-nums",
                      late ? "bg-status-expired-bg text-status-expired" : "text-muted-foreground",
                    )}
                  >
                    {dmy(t.taskDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {counts.pending > tasks.length ? (
          <Link
            href="/tasks?status=PENDING"
            className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs hover:underline"
          >
            {counts.pending - tasks.length} more pending
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Needs attention ------------------------------------------------------------

async function AttentionCard({ ctx }: { ctx: ActorContext }) {
  const rows = await needsAttention(ctx);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4" />
          Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="text-status-valid size-8" />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-muted-foreground text-xs">
              Rent, contracts, certificates, policies and services are all in date.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md px-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.label}</p>
                    <p className="text-muted-foreground truncate text-xs">{r.hint}</p>
                  </div>
                  <span
                    className={cn(
                      "min-w-8 shrink-0 rounded-full px-2 py-0.5 text-center text-sm font-semibold tabular-nums",
                      TONE_CHIP[r.tone],
                    )}
                  >
                    {r.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Expiring -------------------------------------------------------------------

async function ExpiringCard({ ctx }: { ctx: ActorContext }) {
  const [items, counts] = await Promise.all([
    listExpiring(ctx, { withinDays: 60, limit: 8 }),
    renewalCounts(ctx),
  ]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <IdCard className="size-4" />
            Renewals — expired and next 60 days
          </CardTitle>
          <div className="flex gap-1.5 text-xs">
            <span className={cn("rounded-full px-2 py-0.5", TONE_CHIP.expired)}>
              {counts.expired} expired
            </span>
            <span className={cn("rounded-full px-2 py-0.5", TONE_CHIP.warning)}>
              {counts.within30} in 30 days
            </span>
            <span className={cn("rounded-full px-2 py-0.5", TONE_CHIP.neutral)}>
              {counts.within90} in 90 days
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="text-status-valid size-8" />
            <p className="text-sm font-medium">Nothing expiring in the next 60 days</p>
            <p className="text-muted-foreground text-xs">
              Iqamas, passports, contracts, vehicles, policies and certificates all feed this.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-2">
                  <div className="min-w-0">
                    {item.employeeId ? (
                      <Link
                        href={`/people/employees/${item.employeeId}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium">{item.label}</p>
                    )}
                    <p className="text-muted-foreground text-xs capitalize">
                      {item.source.replace(/_/g, " ").toLowerCase()}
                    </p>
                  </div>
                  <ExpiryAlert date={item.expiryDate} />
                </li>
              ))}
            </ul>
            <Link
              href="/people/iqama"
              className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs hover:underline"
            >
              Iqama &amp; passport renewals
              <ArrowRight className="size-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Leave ----------------------------------------------------------------------

async function LeaveCard({ ctx }: { ctx: ActorContext }) {
  const leave = await leaveSnapshot(ctx);
  if (!leave) return null;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4" />
            Leave
          </CardTitle>
          <Link href="/people/leave" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Open
            <ArrowRight />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <LeaveList
          title="Away today"
          empty="Everyone is in."
          rows={leave.away.map((l) => ({
            id: l.id,
            name: l.name,
            type: l.type,
            date: `until ${dmy(l.until)}`,
          }))}
        />
        <LeaveList
          title="Going in the next 14 days"
          empty="No leave starting soon."
          rows={leave.soon.map((l) => ({
            id: l.id,
            name: l.name,
            type: l.type,
            date: `from ${dmy(l.from)}`,
          }))}
        />
      </CardContent>
    </Card>
  );
}

function LeaveList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; type: string; date: string }[];
}) {
  const shown = rows.slice(0, 5);
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {title} · {rows.length}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {r.name}
                <span className="text-muted-foreground text-xs"> · {r.type}</span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{r.date}</span>
            </li>
          ))}
          {rows.length > shown.length ? (
            <li className="text-muted-foreground text-xs">+{rows.length - shown.length} more</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

// --- Staff ----------------------------------------------------------------------

async function StaffCard({ ctx }: { ctx: ActorContext }) {
  const [staff, departments] = await Promise.all([staffSummary(ctx), headcountByDepartment(ctx)]);
  if (!staff) return null;
  const total = (k: keyof Omit<(typeof staff)[number], "code">) =>
    staff.reduce((s, r) => s + r[k], 0);
  const columns = [
    ["active", "On strength"],
    ["onLeave", "On leave today"],
    ["newHires", "New hires (not joined)"],
    ["joined", "Joined this month"],
    ["left", "Left this month"],
  ] as const;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4" />
              Staff by company
            </CardTitle>
            <Link
              href="/people/employees"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Employees
              <ArrowRight />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs">
                  <th className="py-2 pr-3 text-left font-medium">Company</th>
                  {columns.map(([key, label]) => (
                    <th key={key} className="px-3 py-2 text-right font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((r) => (
                  <tr key={r.code} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.code}</td>
                    {columns.map(([key]) => (
                      <td
                        key={key}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          r[key] === 0 && "text-muted-foreground",
                        )}
                      >
                        {r[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {staff.length > 1 ? (
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    {columns.map(([key]) => (
                      <td key={key} className="px-3 py-2 text-right tabular-nums">
                        {total(key)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </CardContent>
      </Card>
      {departments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By department</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={departments.map((d) => ({ label: d.name, count: d.count }))}
              unit="employees"
              centreLabel="Staff"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// --- Helpers --------------------------------------------------------------------

/** "Good morning, Talha", by the clock in Riyadh. */
function greeting(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Riyadh",
    }).format(new Date()),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date());
}
