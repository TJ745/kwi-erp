import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listCompanies } from "@/server/services/org";
import { CompanyDialog } from "./company-dialog";
import { Letterhead } from "./letterhead";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const ctx = await requirePagePermission("companies.view");
  const companies = await listCompanies(ctx);
  const canManage = ctx.permissions.has("companies.manage");

  return (
    <PageShell>
      <PageHeader
        printable
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
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">{company.code}</p>
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

                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground text-xs">VAT number</dt>
                    <dd className="truncate font-mono text-xs">{company.vatNumber ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground text-xs">Address</dt>
                    <dd className="truncate text-xs">{company.addressLine ?? "—"}</dd>
                  </div>
                </dl>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <CompanyDialog
                      mode="edit"
                      company={{
                        id: company.id,
                        code: company.code,
                        name: company.name,
                        shortName: company.shortName,
                        city: company.city,
                        crNumber: company.crNumber,
                        registrationNo: company.registrationNo,
                        vatNumber: company.vatNumber,
                        addressLine: company.addressLine,
                        nameAr: company.nameAr,
                        addressAr: company.addressAr,
                        cityAr: company.cityAr,
                        headOfficeCity: company.headOfficeCity,
                        headOfficeCityAr: company.headOfficeCityAr,
                        signatoryName: company.signatoryName,
                        signatoryNameAr: company.signatoryNameAr,
                        signatoryTitle: company.signatoryTitle,
                        signatoryTitleAr: company.signatoryTitleAr,
                        country: company.country,
                        phone: company.phone,
                        email: company.email,
                        website: company.website,
                        status: company.status,
                      }}
                    />
                    <Letterhead
                      companyId={company.id}
                      companyCode={company.code}
                      hasHeader={company.headerImageFileId !== null}
                      hasFooter={company.footerImageFileId !== null}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
