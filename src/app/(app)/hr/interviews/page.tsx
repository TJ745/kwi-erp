import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { FINAL_ACTION_LABELS, RECOMMENDATION_LABELS } from "@/lib/recruitment-forms";
import { requirePagePermission } from "@/server/auth/page-guards";
import { orgOptions } from "@/server/services/org";
import {
  intervieweeOptions,
  listInterviews,
  prrOptions,
} from "@/server/services/recruitment";
import { deleteInterviewAction } from "@/server/actions/recruitment";
import { InterviewDialog } from "./interview-dialog";

export const metadata: Metadata = { title: "Interview Evaluations" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.offers.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("hr.offers.manage");

  const [interviews, options, prrs, employees] = await Promise.all([
    listInterviews(ctx, q),
    orgOptions(ctx),
    canManage ? prrOptions(ctx) : Promise.resolve([]),
    canManage ? intervieweeOptions(ctx) : Promise.resolve([]),
  ]);
  const companies = options.companies.map((c) => ({ id: c.id, code: c.code }));

  return (
    <PageShell>
      <PageHeader
        title="Interview Evaluations"
        description="Interview Evaluation Reports, each against a PRR. A job offer can then be made from an interview."
        action={canManage ? <InterviewDialog companies={companies} prrs={prrs} employees={employees} /> : null}
      />
      <SearchInput placeholder="Search applicant or position…" />
      {interviews.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={q ? "No matching interviews" : "No interviews"}
          description={q ? "Try a different search term." : "Record an interview against a PRR."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Applicant</th>
                <th className="px-3 py-2 text-left font-medium">Position</th>
                <th className="px-3 py-2 text-left font-medium">PRR No.</th>
                <th className="px-3 py-2 text-left font-medium">Recommendation</th>
                <th className="px-3 py-2 text-left font-medium">Offer</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {interviews.map((i) => {
                const rec = i.details.deptAction || i.details.hrAction;
                return (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{i.applicantName}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {day(i.interviewDate)} · {i.company.code}
                      </p>
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{i.positionTitle}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.prr?.prrNo ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {i.details.finalAction ? (
                        <Badge
                          variant={i.details.finalAction === "APPROVED" ? "default" : "destructive"}
                        >
                          {FINAL_ACTION_LABELS[i.details.finalAction]}
                        </Badge>
                      ) : rec ? (
                        RECOMMENDATION_LABELS[rec]
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {i.offers.length > 0 ? (
                        <Link href="/hr/offers" className="font-mono hover:underline">
                          {i.offers.map((o) => o.refNo ?? o.status).join(", ")}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/hr/interviews/${i.id}`}>
                            <Printer />
                            Print
                          </Link>
                        </Button>
                        {canManage ? (
                          <>
                            <InterviewDialog
                              companies={companies}
                              prrs={prrs}
                              employees={employees}
                              interview={{
                                id: i.id,
                                companyId: i.companyId,
                                prrId: i.prrId,
                                employeeId: i.employeeId,
                                applicantName: i.applicantName,
                                positionTitle: i.positionTitle,
                                interviewDate: day(i.interviewDate),
                                details: i.details,
                              }}
                            />
                            <DeleteRecordButton
                              id={i.id}
                              label={`the interview of ${i.applicantName}`}
                              action={deleteInterviewAction}
                            />
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
