import type { Metadata } from "next";
import Link from "next/link";
import { Printer, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { requirePagePermission } from "@/server/auth/page-guards";
import { joiningEmployeeOptions, listJoiningLetters } from "@/server/services/recruitment";
import { deleteJoiningLetterAction } from "@/server/actions/recruitment";
import { JoiningDialog } from "./joining-dialog";

export const metadata: Metadata = { title: "Joining Letters" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function JoiningLettersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("hr.manage");

  const [letters, employees] = await Promise.all([
    listJoiningLetters(ctx, { q }),
    canManage ? joiningEmployeeOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Joining Letters"
        description="New Appointment Acknowledgment for each new employee. Pick the employee and the letter fills in; it also shows on the employee's profile."
        action={canManage ? <JoiningDialog employees={employees} /> : null}
      />
      <SearchInput placeholder="Search employee…" />
      {letters.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={q ? "No matching letters" : "No joining letters"}
          description={q ? "Try a different search term." : "Create one for a new employee."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Position</th>
                <th className="px-3 py-2 text-left font-medium">Section</th>
                <th className="px-3 py-2 text-left font-medium">Joining date</th>
                <th className="px-3 py-2 text-left font-medium">Letter date</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {letters.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/people/employees/${l.employeeId}`}
                      className="font-medium hover:underline"
                    >
                      {l.employee.fullName}
                    </Link>
                    <p className="text-muted-foreground font-mono text-xs">
                      {l.employee.employeeNo} · {l.employee.company.code}
                    </p>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{l.positionTitle || "—"}</td>
                  <td className="text-muted-foreground px-3 py-2">{l.section || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{day(l.joiningDate)}</td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {day(l.letterDate)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/joining-letters/${l.id}`}>
                          <Printer />
                          Print
                        </Link>
                      </Button>
                      {canManage ? (
                        <>
                          <JoiningDialog
                            employees={employees}
                            letter={{
                              id: l.id,
                              employeeId: l.employeeId,
                              letterDate: day(l.letterDate),
                              joiningDate: day(l.joiningDate),
                              positionTitle: l.positionTitle,
                              section: l.section,
                              remarks: l.remarks,
                            }}
                          />
                          <DeleteRecordButton
                            id={l.id}
                            label="this joining letter"
                            action={deleteJoiningLetterAction}
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
