import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Layers,
  ListChecks,
  UserPlus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { CardLoadingState, EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  dashboardKpis,
  expiryOutlook,
  headcountByDepartment,
  moduleTotals,
  openWorkByModule,
  pendingWork,
} from "@/server/services/dashboard";
import { CategoryBars, OrdinalBars } from "@/components/charts/bar-chart";
import { listExpiring } from "@/server/services/expiry";
import { overdueTasks } from "@/server/services/tasks";
import type { ActorContext } from "@/server/auth/context";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Operational dashboard.
 *
 * Built up module by module: cards appear as their data source lands, rather
 * than being assembled once at the end and rebuilt every phase. Slower sections
 * stream via Suspense so the KPI row paints first.
 */
export default async function DashboardPage() {
  const ctx = await requirePagePermission("dashboard.view");

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="What is expiring, what is pending, and what needs attention today."
        action={
          ctx.permissions.has("employees.create") ? (
            <Link
              href="/people/employees/new"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <UserPlus />
              Add employee
            </Link>
          ) : null
        }
      />

      <Suspense fallback={<CardLoadingState count={4} />}>
        <KpiRow ctx={ctx} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardLoadingState count={1} />}>
          <ExpiryOutlookChart ctx={ctx} />
        </Suspense>
        <Suspense fallback={<CardLoadingState count={1} />}>
          <HeadcountChart ctx={ctx} />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardLoadingState count={1} />}>
          <OpenWorkChart ctx={ctx} />
        </Suspense>
        <Suspense fallback={<CardLoadingState count={1} />}>
          <NeedsAttention ctx={ctx} />
        </Suspense>
      </div>

      <Suspense fallback={<CardLoadingState count={4} />}>
        <ModuleStrip ctx={ctx} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardLoadingState count={1} />}>
          <ExpiringSoon ctx={ctx} />
        </Suspense>

        {ctx.permissions.has("tasks.view") ? (
          <Suspense fallback={<CardLoadingState count={1} />}>
            <OverdueTasks ctx={ctx} />
          </Suspense>
        ) : null}
      </div>
    </PageShell>
  );
}

/**
 * What is waiting on the actor, across every module with a queue.
 *
 * Each row is gated on the permission that lets the actor clear it, so this is
 * a to-do list rather than a status board — and the whole card disappears when
 * there is nothing to do, instead of showing seven zeroes.
 */
async function NeedsAttention({ ctx }: { ctx: ActorContext }) {
  const work = await pendingWork(ctx);

  const rows = ([
    { label: "Petty cash awaiting approval", count: work.pettyCash, href: "/admin/petty-cash", tone: "warning" },
    { label: "Leave requests awaiting approval", count: work.leave, href: "/people/leave", tone: "warning" },
    { label: "Increments awaiting approval", count: work.increments, href: "/hr/increments", tone: "warning" },
    { label: "Open IT tickets", count: work.openTickets, href: "/it/helpdesk", tone: "neutral" },
    { label: "Vehicle services due", count: work.maintenanceDue, href: "/vehicles/maintenance", tone: "neutral" },
    { label: "Onboarding in progress", count: work.onboarding, href: "/people/onboarding", tone: "neutral" },
    { label: "Offboarding in progress", count: work.offboarding, href: "/people/offboarding", tone: "neutral" },
  ] as const).filter((row) => row.count > 0);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListChecks className="size-4" />
          Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.href + row.label}>
              <Link
                href={row.href}
                className="group flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="group-hover:underline">{row.label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={
                      row.tone === "warning"
                        ? "text-status-warning font-semibold tabular-nums"
                        : "font-semibold tabular-nums"
                    }
                  >
                    {row.count}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

async function OverdueTasks({ ctx }: { ctx: ActorContext }) {
  const tasks = await overdueTasks(ctx, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListChecks className="size-4" />
          Overdue tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            title="Nothing overdue"
            description="Tasks past their due date appear here."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {task.taskNo}
                    {task.assignedToName ? ` · ${task.assignedToName}` : " · unassigned"}
                  </p>
                </div>
                <span className="text-status-expired shrink-0 text-xs font-medium tabular-nums">
                  {task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What is coming due, bucketed nearest-first.
 *
 * The single-hue ramp is deliberate. The app's status colours are not a
 * categorical palette — amber against red measures ΔE 2.9 for deuteranopes and
 * 13.9 for normal vision, so the two most urgent buckets would have been the
 * hardest pair to tell apart. Severity is carried by the axis order and by
 * lightness instead, which survives both colour blindness and a monochrome
 * print.
 */
async function ExpiryOutlookChart({ ctx }: { ctx: ActorContext }) {
  const buckets = await expiryOutlook(ctx);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4" />
          Expiry outlook — next 90 days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            title="Nothing expiring in the next 90 days"
            description="Iqamas, passports, contracts, certificates, and vehicle documents all feed this."
            className="border-0 py-6"
          />
        ) : (
          <OrdinalBars data={buckets} unit="expiring" />
        )}
      </CardContent>
    </Card>
  );
}

/** Active headcount per department. One measure, so one colour and no legend. */
async function HeadcountChart({ ctx }: { ctx: ActorContext }) {
  const rows = await headcountByDepartment(ctx);
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="size-4" />
          Active headcount by department
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CategoryBars
          data={rows.map((r) => ({ label: r.name, count: r.count }))}
          unit="employees"
        />
      </CardContent>
    </Card>
  );
}

/**
 * Open work across every module, in one place.
 *
 * Rows are dropped when the count is zero rather than shown as empty bars: a
 * chart of nine zeroes says less than the absence of a chart.
 */
async function OpenWorkChart({ ctx }: { ctx: ActorContext }) {
  const rows = await openWorkByModule(ctx);
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="size-4" />
          Open across modules
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CategoryBars
          data={rows.map((r) => ({ label: r.label, count: r.count }))}
          unit="open"
        />
      </CardContent>
    </Card>
  );
}

/**
 * One number per module for the ones that do not warrant a chart.
 *
 * A count the actor may not see is absent, not zero — a zero is a fact and
 * "you cannot see this" is not one.
 */
async function ModuleStrip({ ctx }: { ctx: ActorContext }) {
  const totals = await moduleTotals(ctx);

  const tiles: { label: string; value: string; href: string }[] = [];
  const push = (label: string, value: number | null, href: string, suffix = "") => {
    if (value === null) return;
    tiles.push({ label, value: `${String(value)}${suffix}`, href });
  };

  push("Vehicles", totals.vehicles, "/vehicles");
  if (totals.bedsTotal !== null && totals.bedsTotal > 0) {
    tiles.push({
      label: "Beds occupied",
      value: `${String(totals.bedsOccupied ?? 0)} / ${String(totals.bedsTotal)}`,
      href: "/admin/accommodation",
    });
  }
  push("Documents", totals.documents, "/documents");
  push("Letters issued", totals.letters, "/hr/letters");
  push("Active policies", totals.policies, "/insurance");
  push("Suppliers", totals.suppliers, "/admin/suppliers");
  push("Subcontractors", totals.subcontractors, "/admin/subcontractors");
  push("Certificates", totals.certificates, "/admin/certificates");

  if (tiles.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Across the system
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="hover:border-foreground/20 h-full gap-0 py-3 transition-colors">
              <CardContent className="px-3">
                <p className="text-lg font-semibold tabular-nums">{tile.value}</p>
                <p className="text-muted-foreground truncate text-xs">{tile.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function KpiRow({ ctx }: { ctx: ActorContext }) {
  const kpis = await dashboardKpis(ctx);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Total employees" value={kpis.totalEmployees} href="/people/employees" />
      <Kpi
        label="Active employees"
        value={kpis.activeEmployees}
        href="/people/employees?status=ACTIVE"
      />
      <Kpi
        label="Expired documents"
        value={kpis.expiredDocuments}
        tone={kpis.expiredDocuments > 0 ? "expired" : "neutral"}
        href="/people/iqama"
      />
      <Kpi
        label="Expiring in 30 days"
        value={kpis.expiringIn30Days}
        tone={kpis.expiringIn30Days > 0 ? "warning" : "neutral"}
        href="/people/iqama?within=30"
      />
    </div>
  );
}

async function ExpiringSoon({ ctx }: { ctx: ActorContext }) {
  const items = await listExpiring(ctx, { withinDays: 60, limit: 10 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4" />
          Expiring soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="Nothing expiring in the next 60 days"
            description="Iqama, passport, contract, vehicle, and certificate expiries all appear here."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  {item.employeeId ? (
                    <Link
                      href={`/people/employees/${item.employeeId}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{item.label}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {item.source.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <ExpiryAlert date={item.expiryDate} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "neutral" | "warning" | "expired";
}) {
  const body = (
    <Card className="gap-0 py-4 transition-colors hover:border-foreground/20">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={
            tone === "expired"
              ? "text-status-expired text-2xl font-semibold tabular-nums"
              : tone === "warning"
                ? "text-status-warning text-2xl font-semibold tabular-nums"
                : "text-2xl font-semibold tabular-nums"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
