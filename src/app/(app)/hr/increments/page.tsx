import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { formatAmount } from "@/lib/increments";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listIncrementLists } from "@/server/services/increments";
import { IncrementListDialog } from "./list-dialog";
import { IncrementListRowActions } from "./list-row-actions";

export const metadata: Metadata = { title: "Increments" };

export default async function IncrementsPage() {
  const ctx = await requirePagePermission("hr.increments.view");
  const canSeeSalary = ctx.permissions.has("employees.salary.view");
  const canManage = canSeeSalary && ctx.permissions.has("hr.increments.manage");

  if (!canSeeSalary) {
    return (
      <PageShell>
        <PageHeader title="Increments" description="Salary increment lists." />
        <EmptyState
          icon={TrendingUp}
          title="Salary figures are hidden"
          description="Increment lists are salary data. Ask an administrator for the “View salary data” permission."
        />
      </PageShell>
    );
  }

  const lists = await listIncrementLists(ctx);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Increments"
        description="Salary increment lists: current, demanded and proposed salary per employee. A list is a document to print — it never changes anyone's salary."
        action={canManage ? <IncrementListDialog /> : null}
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No increment lists yet"
          description="Create a list, add employees, and their current salary fills in from the employee record."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-right font-medium">Employees</th>
                <th className="px-3 py-2 text-right font-medium">Current total</th>
                <th className="px-3 py-2 text-right font-medium">Demanded total</th>
                <th className="px-3 py-2 text-right font-medium">Proposed total</th>
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
                    <Link href={`/hr/increments/${l.id}`} className="font-medium hover:underline">
                      {l.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.employees}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(l.currentTotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(l.demandedTotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(l.proposedTotal)}
                  </td>
                  <td className="px-3 py-2" data-print-hide>
                    <IncrementListRowActions
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
