import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { requirePagePermission } from "@/server/auth/page-guards";
import { employeeOptions } from "@/server/services/hr-records";
import { listClearanceForms } from "@/server/services/recruitment";
import { deleteClearanceAction } from "@/server/actions/recruitment";
import { ClearanceDialog } from "./clearance-dialog";

export const metadata: Metadata = { title: "Clearance Forms" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function ClearanceFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("hr.manage");

  const [forms, employees] = await Promise.all([
    listClearanceForms(ctx, { q }),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
  ]);
  const picks = employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    employeeNo: e.employeeNo,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Clearance Forms"
        description="Employee clearance when someone leaves. Pick the employee: what they still hold — IT equipment, phone, vehicle, accommodation — fills in from the system."
        action={canManage ? <ClearanceDialog employees={picks} /> : null}
      />
      <SearchInput placeholder="Search employee…" />
      {forms.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={q ? "No matching forms" : "No clearance forms"}
          description={q ? "Try a different search term." : "Create one when an employee leaves."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Department</th>
                <th className="px-3 py-2 text-left font-medium">Position</th>
                <th className="px-3 py-2 text-left font-medium">End date</th>
                <th className="px-3 py-2 text-left font-medium">Form date</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/people/employees/${f.employeeId}`}
                      className="font-medium hover:underline"
                    >
                      {f.employee.fullName}
                    </Link>
                    <p className="text-muted-foreground font-mono text-xs">
                      {f.employee.employeeNo} · {f.employee.company.code}
                    </p>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{f.details.department || "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{f.details.position || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{f.endDate ? day(f.endDate) : "—"}</td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {day(f.formDate)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/clearance/${f.id}`}>
                          <Printer />
                          Print
                        </Link>
                      </Button>
                      {canManage ? (
                        <>
                          <ClearanceDialog
                            employees={picks}
                            form={{
                              id: f.id,
                              employeeId: f.employeeId,
                              formDate: day(f.formDate),
                              endDate: f.endDate ? day(f.endDate) : "",
                              details: f.details,
                            }}
                          />
                          <DeleteRecordButton
                            id={f.id}
                            label="this clearance form"
                            action={deleteClearanceAction}
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
