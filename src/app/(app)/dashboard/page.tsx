import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { CardLoadingState, EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { dashboardKpis } from "@/server/services/dashboard";
import { listExpiring } from "@/server/services/expiry";
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

      <Suspense fallback={<CardLoadingState count={1} />}>
        <ExpiringSoon ctx={ctx} />
      </Suspense>
    </PageShell>
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
