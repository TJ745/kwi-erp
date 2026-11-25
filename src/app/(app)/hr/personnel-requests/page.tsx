import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { requirePagePermission } from "@/server/auth/page-guards";
import { orgOptions } from "@/server/services/org";
import { listPrrs, positionManpower } from "@/server/services/recruitment";
import { deletePrrAction } from "@/server/actions/recruitment";
import { PrrDialog } from "./prr-dialog";

export const metadata: Metadata = { title: "Personnel Requests" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function PersonnelRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.offers.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("hr.offers.manage");

  const [prrs, options, manpower] = await Promise.all([
    listPrrs(ctx, q),
    orgOptions(ctx),
    canManage ? positionManpower(ctx) : Promise.resolve({}),
  ]);
  const dialogOptions = { ...options, manpower };

  return (
    <PageShell>
      <PageHeader
        title="Personnel Requests"
        description="Personnel Requirement Requests (PRR), one per vacancy. Interviews are held against a PRR, and the employees hired through it show here."
        action={canManage ? <PrrDialog {...dialogOptions} /> : null}
      />
      <SearchInput placeholder="Search PRR No. or job title…" />
      {prrs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={q ? "No matching requests" : "No personnel requests"}
          description={q ? "Try a different search term." : "Create one to request a new hire."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">PRR No.</th>
                <th className="px-3 py-2 text-left font-medium">Job title</th>
                <th className="px-3 py-2 text-left font-medium">Department</th>
                <th className="px-3 py-2 text-right font-medium">Vacancies</th>
                <th className="px-3 py-2 text-left font-medium">Interviews</th>
                <th className="px-3 py-2 text-left font-medium">Hired</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {prrs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-mono font-medium">{r.prrNo}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {day(r.requestDate)} · {r.company.code}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-medium">{r.jobTitle}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {r.details.divisionDepartment || r.department?.name || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.vacancies}</td>
                  <td className="px-3 py-2">
                    {r.interviewCount > 0 ? (
                      <Link
                        href={`/hr/interviews?q=${encodeURIComponent(r.jobTitle)}`}
                        className="hover:underline"
                      >
                        {r.interviewCount}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.hired.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        r.hired.map((e) => (
                          <Link key={e.id} href={`/people/employees/${e.id}`}>
                            <Badge variant="outline">{e.employeeNo}</Badge>
                          </Link>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/personnel-requests/${r.id}`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
                      {canManage ? (
                        <>
                          <PrrDialog
                            {...dialogOptions}
                            prr={{
                              id: r.id,
                              companyId: r.companyId,
                              prrNo: r.prrNo,
                              requestDate: day(r.requestDate),
                              positionId: r.positionId,
                              departmentId: r.departmentId,
                              jobTitle: r.jobTitle,
                              vacancies: r.vacancies,
                              details: r.details,
                            }}
                          />
                          <DeleteRecordButton
                            id={r.id}
                            label={`request ${r.prrNo}`}
                            action={deletePrrAction}
                          />
                        </>
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
