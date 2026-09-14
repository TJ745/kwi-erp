import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  BadgeCheck,
  CalendarDays,
  FileClock,
  Home,
  IdCard,
  Layers,
  ListChecks,
  Plug,
  UserPlus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { CardLoadingState, EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  DEADLINE_WINDOWS,
  dashboardKpis,
  expiryOutlook,
  headcountByDepartment,
  moduleTotals,
  openWorkByModule,
  operationalDeadlines,
  pendingWork,
  type DeadlinePanel,
} from "@/server/services/dashboard";
import { CategoryBars, OrdinalBars } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { expiryBuckets, listExpiring } from "@/server/services/expiry";
import { IQAMA_BUCKETS } from "@/lib/expiry";
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
        title={greeting(ctx.name)}
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

      <Suspense fallback={<CardLoadingState count={1} />}>
        <ResidencyDocuments ctx={ctx} />
      </Suspense>

      <Suspense fallback={<CardLoadingState count={6} />}>
        <OperationalDeadlines ctx={ctx} />
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

/**
 * Active headcount per department, as part-to-whole.
 *
 * A donut is only honest here because departments genuinely sum to the
 * headcount and the chart is read at a glance. Anything past the top four folds
 * into "Other", so it never becomes a ring of slivers — the failure mode a pie
 * is notorious for.
 */
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
        <DonutChart
          data={rows.map((r) => ({ label: r.name, count: r.count }))}
          unit="employees"
          centreLabel="Active"
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

/**
 * Iqama and passport expiry, counted by window.
 *
 * On the dashboard because a missed Iqama renewal has legal consequences, and
 * "nobody opened the page" is not a defence. This is the ALERT: the counts, and
 * a way through to the records. The working surface stays at /people/iqama,
 * which holds the full list and the filters someone actually processes
 * renewals with — a top-ten list is not a work queue.
 *
 * Deliberately narrowed to IQAMA and PASSPORT. "Expiring soon" further down
 * mixes in contracts, vehicles, and certificates, which is right for a general
 * alert and wrong for the one document class with a statutory deadline.
 */
async function ResidencyDocuments({ ctx }: { ctx: ActorContext }) {
  const sources = ["IQAMA", "PASSPORT"] as const;
  const buckets = await expiryBuckets(ctx, IQAMA_BUCKETS, [...sources]);

  const total = buckets.expired + buckets.buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <IdCard className="size-4" />
            Iqama &amp; passport expiry
          </CardTitle>
          <Link
            href="/people/iqama"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Work through them
            <ArrowRight />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            title="Nothing expiring in the next 90 days"
            description="Iqama and passport expiry dates appear here as soon as they are recorded."
            className="border-0 py-6"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <BucketTile
              label="Expired"
              count={buckets.expired}
              tone="expired"
              href="/people/iqama"
            />
            {buckets.buckets.map((bucket) => (
              <BucketTile
                key={bucket.days}
                label={`${String(bucket.days)} days`}
                count={bucket.count}
                tone={bucket.days <= 15 ? "warning" : "neutral"}
                href={`/people/iqama?within=${String(bucket.days)}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One count, linking into the filtered list.
 *
 * A zero is rendered in muted ink rather than the tone colour: six red tiles
 * reading 0 is the same alarm as six reading 12, and a dashboard that always
 * looks alarming stops being read.
 */
function BucketTile({
  label,
  count,
  tone,
  href,
}: {
  label: string;
  count: number;
  tone: "expired" | "warning" | "neutral";
  href: string;
}) {
  const toneClass =
    count === 0
      ? "text-muted-foreground"
      : tone === "expired"
        ? "text-status-expired"
        : tone === "warning"
          ? "text-status-warning"
          : "text-foreground";

  return (
    <Link
      href={href}
      className="hover:bg-muted/50 focus-visible:ring-ring rounded-lg border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{count}</p>
    </Link>
  );
}

/**
 * The six operational deadlines, one card each.
 *
 * Each card is independent because each is somebody's job: the HR officer
 * chasing leave, the admin clerk paying bills, the person renewing the CR. A
 * single merged list would make everyone read all six to find their one.
 *
 * A card the viewer lacks permission for is ABSENT, not zero — see
 * DeadlinePanel. A zero means "nothing is due"; hiding a permission behind a
 * zero would tell someone the company has no overdue bills when in fact they
 * simply cannot see bills.
 */
async function OperationalDeadlines({ ctx }: { ctx: ActorContext }) {
  const d = await operationalDeadlines(ctx);

  const cards = [
    {
      key: "leave",
      title: "Leave starting soon",
      hint: `Submitted, awaiting approval, travelling within ${String(DEADLINE_WINDOWS.leaveDays)} days`,
      icon: CalendarDays,
      href: "/people/leave",
      tone: "warning" as const,
      panel: d.leaveUpcoming,
    },
    {
      key: "certificates",
      title: "Expired certificates",
      hint: "Company certificates past their expiry date",
      icon: BadgeCheck,
      href: "/admin/certificates",
      tone: "expired" as const,
      panel: d.certificatesExpired,
    },
    {
      key: "bills",
      title: "Electricity bills due",
      hint: `Unpaid, due within ${String(DEADLINE_WINDOWS.billsDays)} days or already overdue`,
      icon: Plug,
      href: "/admin/electricity-bills",
      tone: "warning" as const,
      panel: d.billsDue,
    },
    {
      key: "subcontracts",
      title: "Expired subcontracts",
      hint: "Subcontractor contracts past their end date",
      icon: FileClock,
      href: "/admin/subcontractors",
      tone: "expired" as const,
      panel: d.subcontractsExpired,
    },
    {
      key: "rent",
      title: "Accommodation rent due",
      hint: `Due within ${String(DEADLINE_WINDOWS.rentDays)} days, or already past`,
      icon: Home,
      href: "/admin/accommodation",
      tone: "warning" as const,
      panel: d.rentDue,
    },
    {
      key: "contracts",
      title: "Employee contracts ending",
      hint: `Within ${String(DEADLINE_WINDOWS.contractDays)} days`,
      icon: FileClock,
      href: "/hr/contracts",
      tone: "neutral" as const,
      panel: d.employeeContracts,
    },
  ].filter((c) => c.panel !== null);

  if (cards.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <DeadlineCard
          key={card.key}
          title={card.title}
          hint={card.hint}
          icon={card.icon}
          href={card.href}
          tone={card.tone}
          panel={card.panel}
        />
      ))}
    </div>
  );
}

function DeadlineCard({
  title,
  hint,
  icon: Icon,
  href,
  tone,
  panel,
}: {
  title: string;
  hint: string;
  icon: typeof CalendarDays;
  href: string;
  tone: "expired" | "warning" | "neutral";
  panel: DeadlinePanel;
}) {
  if (panel === null) return null;

  // Zero is shown in muted ink, never in the tone colour. Six cards glowing red
  // at 0 is the same alarm as six at 12, and a dashboard that always looks
  // urgent stops being read.
  const countClass =
    panel.count === 0
      ? "text-muted-foreground"
      : tone === "expired"
        ? "text-status-expired"
        : tone === "warning"
          ? "text-status-warning"
          : "text-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Icon className="size-4 shrink-0" />
              {title}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
          </div>
          <p className={`shrink-0 text-2xl font-semibold tabular-nums ${countClass}`}>
            {panel.count}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {panel.count === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing due.</p>
        ) : (
          <>
            <ul className="divide-y">
              {panel.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.label}</p>
                    {item.sub ? (
                      <p className="text-muted-foreground truncate text-xs">{item.sub}</p>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {item.date.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={href}
              className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
            >
              {panel.count > panel.items.length
                ? `See all ${String(panel.count)}`
                : "Open"}
              <ArrowRight className="size-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
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

/**
 * "Good morning, Talha" — first name only, by the clock where the readers
 * are. Falls back to the plain page title for an account with no name set,
 * rather than greeting nobody.
 */
function greeting(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  if (!first) return "Dashboard";

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Riyadh" })
      .format(new Date()),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${first}`;
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
  const rule =
    tone === "expired"
      ? "border-t-status-expired"
      : tone === "warning"
        ? "border-t-status-warning"
        : "border-t-brand-teal";
  const figure =
    tone === "expired"
      ? "text-status-expired"
      : tone === "warning"
        ? "text-status-warning"
        : "text-foreground";

  const body = (
    <Card className={`gap-0 border-t-[3px] py-4 transition-transform hover:-translate-y-0.5 ${rule}`}>
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs font-semibold">{label}</p>
        <p className={`text-[32px] leading-none font-extrabold tracking-tight tabular-nums ${figure} mt-1.5`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
