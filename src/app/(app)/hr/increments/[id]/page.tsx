import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import { employeesToAdd, getIncrementList } from "@/server/services/increments";
import { IncrementListRowActions } from "../list-row-actions";
import { AddEmployeesDialog } from "./add-employees-dialog";
import { LinesEditor } from "./lines-editor";

export const metadata: Metadata = { title: "Increment list" };

export default async function IncrementListPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.increments.view");
  if (!ctx.permissions.has("employees.salary.view")) redirect("/hr/increments");
  const canManage = ctx.permissions.has("hr.increments.manage");
  const { id } = await params;

  const [list, pickable] = await Promise.all([
    getIncrementList(ctx, id).catch((error: unknown) => {
      if (error instanceof AppError) notFound();
      throw error;
    }),
    canManage ? employeesToAdd(ctx, id) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/hr/increments">
              <ArrowLeft />
              All lists
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{list.title}</h1>
            <p className="text-muted-foreground text-xs">
              {list.listDate.toISOString().slice(0, 10)} · {list.lines.length} employee
              {list.lines.length === 1 ? "" : "s"}
              {list.notes ? ` · ${list.notes}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? <AddEmployeesDialog listId={list.id} employees={pickable} /> : null}
          <Button asChild size="sm" variant="outline">
            <Link href={`/hr/increments/${list.id}/print`} target="_blank" rel="noopener">
              <Printer />
              Print list
            </Link>
          </Button>
          <IncrementListRowActions
            canManage={canManage}
            afterDelete="/hr/increments"
            list={{
              id: list.id,
              title: list.title,
              listDate: list.listDate.toISOString().slice(0, 10),
              notes: list.notes,
            }}
          />
        </div>
      </div>

      <LinesEditor
        // A fresh editor whenever the set of lines changes (add / remove), so
        // its local state never outlives the rows it was built from.
        key={list.lines.map((l) => l.id).join(",")}
        listId={list.id}
        canManage={canManage}
        lines={list.lines.map((l) => ({
          id: l.id,
          employeeNo: l.employeeNo,
          name: l.name,
          sponsor: l.sponsor,
          position: l.position,
          current: l.current,
          demanded: l.demanded,
          proposed: l.proposed,
        }))}
      />
    </PageShell>
  );
}
