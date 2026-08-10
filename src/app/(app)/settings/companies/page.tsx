import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listCompanies } from "@/server/services/org";
import { CompanyDialog } from "./company-dialog";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const ctx = await requirePagePermission("companies.view");
  const companies = await listCompanies(ctx);
  const canManage = ctx.permissions.has("companies.manage");

  return (
    <PageShell>
      <PageHeader
        title="Companies"
        description="Every operational record belongs to a company. Users see only the companies they are granted."
        action={canManage ? <CompanyDialog mode="create" /> : null}
      />

      {companies.length === 0 ? (
        <EmptyState icon={Building2} title="No companies" description="Add the first company." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{company.name}</CardTitle>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {company.code}
                    </p>
                  </div>
                  <StatusBadge status={company.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Employees</dt>
                    <dd className="font-medium tabular-nums">{company._count.employees}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Departments</dt>
                    <dd className="font-medium tabular-nums">{company._count.departments}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">City</dt>
                    <dd className="font-medium">{company.city ?? "—"}</dd>
                  </div>
                </dl>

                {canManage ? (
                  <CompanyDialog
                    mode="edit"
                    company={{
                      id: company.id,
                      code: company.code,
                      name: company.name,
                      shortName: company.shortName,
                      city: company.city,
                      crNumber: company.crNumber,
                      status: company.status,
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
