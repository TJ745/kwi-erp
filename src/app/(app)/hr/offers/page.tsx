import type { Metadata } from "next";
import Link from "next/link";
import { Printer, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listJobDescriptions, listJobOffers, offerCounts } from "@/server/services/hiring";
import { orgOptions } from "@/server/services/org";
import { interviewOptions } from "@/server/services/recruitment";
import { OfferDialog } from "./offer-dialog";
import { OfferRowActions } from "./offer-row-actions";
import { ReportLink } from "@/components/shared/report-link";
import { DocumentsLink } from "@/components/shared/documents-link";

export const metadata: Metadata = { title: "Job Offers" };

export default async function JobOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.offers.view");
  const { status, q } = await searchParams;

  const canManage = ctx.permissions.has("hr.offers.manage");
  // Documents are readable by more people than may edit an offer.
  const canViewDocs = ctx.permissions.has("documents.view");
  const canConvert = ctx.permissions.has("employees.create");
  // The proposed salary is salary data like any other.
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const [offers, counts, descriptions, options, interviews] = await Promise.all([
    listJobOffers(ctx, { ...(status ? { status } : {}), ...(q ? { q } : {}) }),
    offerCounts(ctx),
    canManage ? listJobDescriptions(ctx) : Promise.resolve([]),
    orgOptions(ctx),
    canManage ? interviewOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Job Offers"
        description="Candidates through to hire. Accepting an offer is not hiring — converting it creates the employee record, and that can only happen once."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="job-offer-register" ctx={ctx} />
            {canManage ? (
              <OfferDialog
                companies={options.companies}
                positions={options.positions}
                descriptions={descriptions.map((d) => ({ id: d.id, title: d.title }))}
                interviews={interviews}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open (draft or sent)" value={counts.open} />
        <StatCard label="Accepted, not yet converted" value={counts.accepted} />
        <StatCard label="Converted to employees" value={counts.converted} />
      </div>

      <SearchInput placeholder="Search candidate name…" />

      {offers.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={q ? "No matching offers" : "No offers"}
          description={q ? "Try a different search term." : "Create an offer to start."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Candidate</th>
                <th className="px-3 py-2 text-left font-medium">Position</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                {canSeeSalary ? (
                  <th className="px-3 py-2 text-right font-medium">Proposed</th>
                ) : null}
                <th className="px-3 py-2 text-left font-medium">Joining</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{o.candidateName}</p>
                    {o.refNo ? (
                      <p className="text-muted-foreground font-mono text-xs">{o.refNo}</p>
                    ) : null}
                    {o.candidateEmail ? (
                      <p className="text-muted-foreground text-xs">{o.candidateEmail}</p>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{o.position?.title ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{o.company.code}</td>
                  {canSeeSalary ? (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {o.proposedSalary ? `${o.proposedSalary.toString()} ${o.currency}` : "—"}
                    </td>
                  ) : null}
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {o.proposedJoiningDate ? o.proposedJoiningDate.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {o.convertedEmployee ? (
                      <Link
                        href={`/people/employees/${o.convertedEmployee.id}`}
                        className="hover:underline"
                      >
                        <Badge variant="default">→ {o.convertedEmployee.employeeNo}</Badge>
                      </Link>
                    ) : (
                      <Badge
                        variant={
                          o.status === "ACCEPTED"
                            ? "default"
                            : o.status === "DECLINED" || o.status === "WITHDRAWN"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {o.status}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1" data-print-hide>
                      {/* The letter carries the salary, so printing it needs the
                          salary permission too. */}
                      {canSeeSalary ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/hr/offers/${o.id}`}>
                            <Printer />
                            Print
                          </Link>
                        </Button>
                      ) : null}
                      {canViewDocs ? (
                        <DocumentsLink
                          entityType="JOB_OFFER"
                          entityId={o.id}
                          label={o.candidateName}
                        />
                      ) : null}
                      {/* Still gated: viewing documents does not imply the
                          right to edit or convert an offer. */}
                      {canManage || canConvert ? (
                        <OfferRowActions
                          offer={{
                            id: o.id,
                            companyId: o.companyId,
                            candidateName: o.candidateName,
                            candidateEmail: o.candidateEmail,
                            candidatePhone: o.candidatePhone,
                            salutation: o.salutation,
                            candidateIdType: o.candidateIdType,
                            candidateIdNumber: o.candidateIdNumber,
                            candidateAddress: o.candidateAddress,
                            offerDate: o.offerDate ? o.offerDate.toISOString().slice(0, 10) : null,
                            refNo: o.refNo,
                            basicSalary: canSeeSalary ? (o.basicSalary?.toString() ?? null) : null,
                            housingAllowance: canSeeSalary
                              ? (o.housingAllowance?.toString() ?? null)
                              : null,
                            transportAllowance: canSeeSalary
                              ? (o.transportAllowance?.toString() ?? null)
                              : null,
                            mobileAllowance: canSeeSalary
                              ? (o.mobileAllowance?.toString() ?? null)
                              : null,
                            contractYears: o.contractYears,
                            probationDays: o.probationDays,
                            familyStatus: o.familyStatus,
                            leavePlan: o.leavePlan,
                            ticketCover: o.ticketCover,
                            ticketDestination: o.ticketDestination,
                            medicalCover: o.medicalCover,
                            positionId: o.positionId,
                            jobDescriptionId: o.jobDescriptionId,
                            proposedSalary: canSeeSalary
                              ? (o.proposedSalary?.toString() ?? null)
                              : null,
                            currency: o.currency,
                            proposedJoiningDate: o.proposedJoiningDate
                              ? o.proposedJoiningDate.toISOString().slice(0, 10)
                              : null,
                            status: o.status,
                            sentAt: o.sentAt ? o.sentAt.toISOString().slice(0, 10) : null,
                            notes: o.notes,
                            interviewId: o.interviewId,
                            isConverted: o.convertedEmployeeId !== null,
                          }}
                          companies={options.companies}
                          positions={options.positions}
                          departments={options.departments}
                          descriptions={descriptions.map((d) => ({
                            id: d.id,
                            title: d.title,
                          }))}
                          interviews={interviews}
                          canManage={canManage}
                          canConvert={canConvert}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
