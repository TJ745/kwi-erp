import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import { employeesForList, getEvaluationList } from "@/server/services/evaluations";
import { EvaluationListRowActions } from "../list-row-actions";
import { AddEvaluationDialog } from "./add-evaluation-dialog";
import { RemoveEvaluation } from "./remove-evaluation";

export const metadata: Metadata = { title: "Evaluation list" };

export default async function EvaluationListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const ctx = await requirePagePermission("hr.evaluations.view");
  const canManage = ctx.permissions.has("hr.evaluations.manage");
  const { listId } = await params;

  const [list, employees] = await Promise.all([
    getEvaluationList(ctx, listId).catch((error: unknown) => {
      if (error instanceof AppError) notFound();
      throw error;
    }),
    canManage ? employeesForList(ctx, listId) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/hr/evaluations">
              <ArrowLeft />
              All lists
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{list.title}</h1>
            <p className="text-muted-foreground text-xs">
              {list.listDate.toISOString().slice(0, 10)} · {list.evaluations.length} employee
              {list.evaluations.length === 1 ? "" : "s"}
              {list.notes ? ` · ${list.notes}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <AddEvaluationDialog
              listId={list.id}
              listDate={list.listDate.toISOString().slice(0, 10)}
              employees={employees}
            />
          ) : null}
          <EvaluationListRowActions
            canManage={canManage}
            afterDelete="/hr/evaluations"
            list={{
              id: list.id,
              title: list.title,
              listDate: list.listDate.toISOString().slice(0, 10),
              notes: list.notes,
            }}
          />
        </div>
      </div>

      {list.evaluations.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No one on this list yet. Use “Add employee”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee ID</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Position</th>
                <th className="px-3 py-2 text-left font-medium">Form</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Result</th>
                <th className="w-40 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.evaluations.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{e.employee.employeeNo}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/hr/evaluations/${list.id}/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.employee.fullName}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{e.employee.company.code}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {e.employee.position?.title ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{e.template === "STAFF" ? "Staff" : "Worker"}</Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {e.evaluationDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{e.outcome ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1" data-print-hide>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/evaluations/${list.id}/${e.id}/print`}>
                          <Printer />
                          Print
                        </Link>
                      </Button>
                      {canManage ? (
                        <RemoveEvaluation
                          id={e.id}
                          label={`${e.employee.employeeNo} — ${e.employee.fullName}`}
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
