import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/page-guards";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Phase 3 placeholder. Real KPI cards and alert feeds arrive from Phase 5
 * onward as each module lands. What it demonstrates today is that the
 * authorisation chain resolves end to end.
 */
export default async function DashboardPage() {
  const ctx = await requirePagePermission("dashboard.view");

  const companyLabel =
    ctx.companyScope === "ALL" ? "All companies" : `${ctx.companyScope.length} company scope`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <p className="text-muted-foreground text-sm font-medium">Phase 3 · Auth &amp; RBAC</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Role" value={ctx.roleKey.replace(/_/g, " ")} />
        <Stat label="Permissions" value={String(ctx.permissions.size)} />
        <Stat label="Company scope" value={companyLabel} />
      </dl>

      <p className="text-muted-foreground text-sm leading-relaxed">
        This page is gated by <code className="text-foreground">dashboard.view</code>. Company
        scoping, permission overrides, and audit logging are active.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
