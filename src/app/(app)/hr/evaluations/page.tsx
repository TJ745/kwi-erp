import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listEvaluationLists } from "@/server/services/evaluations";
import { EvaluationListDialog } from "./list-dialog";
import { EvaluationListRowActions } from "./list-row-actions";

export const metadata: Metadata = { title: "Evaluations" };

export default async function EvaluationsPage() {
  const ctx = await requirePagePermission("hr.evaluations.view");
  const canManage = ctx.permissions.has("hr.evaluations.manage");
  const lists = await listEvaluationLists(ctx);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Evaluations"
        description="Evaluation lists. Add employees one by one and fill the Staff (Performance & Development Plan) or Worker (Performance Appraisal) form; each prints like the company's paper form."
        action={canManage ? <EvaluationListDialog /> : null}
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No evaluation lists yet"
          description="Create a list, e.g. “Annual Evaluation 2026”, then add employees to evaluate."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-right font-medium">Staff</th>
                <th className="px-3 py-2 text-right font-medium">Workers</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {l.listDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/hr/evaluations/${l.id}`} className="font-medium hover:underline">
                      {l.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.staff}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.workers}</td>
                  <td className="px-3 py-2" data-print-hide>
                    <EvaluationListRowActions
                      canManage={canManage}
                      list={{
                        id: l.id,
                        title: l.title,
                        listDate: l.listDate.toISOString().slice(0, 10),
                        notes: l.notes,
                      }}
                    />
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
