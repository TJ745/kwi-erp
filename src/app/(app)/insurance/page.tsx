import type { Metadata } from "next";
import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buildQueryString } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  insuranceCounts,
  listPolicies,
  listProviders,
} from "@/server/services/insurance";
import { orgOptions } from "@/server/services/org";
import { PolicyDialog } from "./policy-dialog";
import { enrolmentsForPolicy } from "@/server/services/insurance";
import { employeeOptions } from "@/server/services/hr-records";
import { PolicyTable } from "./policy-table";
import { ProviderDialog } from "./provider-dialog";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Medical Insurance" };

export default async function InsurancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requirePagePermission("insurance.view");
  const { status, q } = await searchParams;

  const canManage = ctx.permissions.has("insurance.manage");

  const [policies, counts, providers, options] = await Promise.all([
    listPolicies(ctx, { status, q }),
    insuranceCounts(ctx),
    listProviders(),
    canManage ? orgOptions(ctx) : Promise.resolve(null),
  ]);

  // Members are fetched per policy, and the employee list only for actors who
  // can actually enrol somebody — it is a list of people, not a lookup table.
  const [enrolmentsByPolicy, employees] = await Promise.all([
    Promise.all(
      policies.map(async (p) => [p.id, await enrolmentsForPolicy(ctx, p.id)] as const),
    ),
    canManage && ctx.permissions.has("employees.view")
      ? employeeOptions(ctx)
      : Promise.resolve([]),
  ]);
  const enrolments = new Map(enrolmentsByPolicy);

  return (
    <PageShell>
      <PageHeader
        title="Medical Insurance"
        description="Company policies and their status. A policy can be in-date yet not working at the clinic — both are tracked."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="insurance-register" ctx={ctx} />
            {canManage && options ? (
              <div className="flex items-center gap-2">
                <ProviderDialog />
                <PolicyDialog
                  companies={options.companies}
                  providers={providers
                    .filter((p) => p.isActive)
                    .map((p) => ({ id: p.id, name: p.name }))}
                />
              </div>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Active" value={counts.active} href="/insurance" />
        <CountCard
          label="Expiring in 60 days"
          value={counts.expiringIn60Days}
          tone="warning"
          href={`/insurance${buildQueryString({}, { status: "ACTIVE" })}`}
        />
        <CountCard
          label="Expired"
          value={counts.expired}
          tone="expired"
          href={`/insurance${buildQueryString({}, { status: "EXPIRED" })}`}
        />
        <CountCard
          label="Not working"
          value={counts.notWorking}
          tone="expired"
          href={`/insurance${buildQueryString({}, { status: "NOT_WORKING" })}`}
        />
      </div>

      {policies.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="No policies"
          description="Add a medical insurance policy to track its expiry and whether it is actually working."
        />
      ) : (
        <PolicyTable
          canManage={canManage}
          enrolments={policies.map((p) => ({
            policyId: p.id,
            rows: (enrolments.get(p.id) ?? []).map((e) => ({
              id: e.id,
              memberNumber: e.memberNumber,
              className: e.className,
              startDate: e.startDate.toISOString().slice(0, 10),
              endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
              status: e.status,
              employee: {
                id: e.employee.id,
                fullName: e.employee.fullName,
                employeeNo: e.employee.employeeNo,
              },
            })),
          }))}
          employees={employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            employeeNo: e.employeeNo,
            companyId: e.companyId,
          }))}
          companies={options?.companies ?? []}
          providers={providers.map((p) => ({ id: p.id, name: p.name }))}
          policies={policies.map((p) => ({
            id: p.id,
            policyNumber: p.policyNumber,
            providerName: p.providerName,
            companyCode: p.companyCode,
            companyId: p.companyId,
            providerId: p.providerId,
            className: p.className,
            startDate: p.startDate.toISOString().slice(0, 10),
            expiryDate: p.expiryDate.toISOString(),
            status: p.status,
            isWorking: p.isWorking,
            memberCount: p.memberCount,
          }))}
        />
      )}

      {providers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Providers</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Card key={provider.id} className="gap-0 py-4">
                <CardContent className="px-4">
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {provider.contactPerson ?? "No contact"}
                    {provider.phone ? ` · ${provider.phone}` : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                    {provider._count.policies}{" "}
                    {provider._count.policies === 1 ? "policy" : "policies"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
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
