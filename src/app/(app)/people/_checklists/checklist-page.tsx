import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { ChecklistTypeValue } from "@/lib/schemas/hr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listChecklists, templatesFor } from "@/server/services/checklists";
import { listEmployees } from "@/server/services/employees";
import { StartChecklistButton } from "./start-checklist";

/**
 * One page component serves onboarding, offboarding, and clearance — the ADR-006
 * payoff. The only differences are the type, the copy, and the permission.
 */
export async function ChecklistPage({
  type,
  title,
  description,
  viewPermission,
  managePermission,
}: {
  type: ChecklistTypeValue;
  title: string;
  description: string;
  viewPermission: "hr.onboarding.view" | "hr.offboarding.view";
  managePermission: "hr.onboarding.manage" | "hr.offboarding.manage";
}) {
  const ctx = await requirePagePermission(viewPermission);
  const canManage = ctx.permissions.has(managePermission);

  const [instances, templates, employees] = await Promise.all([
    listChecklists(ctx, type),
    canManage ? templatesFor(type) : Promise.resolve([]),
    canManage
      ? listEmployees(ctx, { page: 1, pageSize: 100, q: undefined, sort: undefined })
      : Promise.resolve(null),
  ]);

  const open = instances.filter((i) => i.status === "IN_PROGRESS");
  const closed = instances.filter((i) => i.status !== "IN_PROGRESS");

  return (
    <PageShell>
      <PageHeader
        title={title}
        description={description}
        action={
          canManage ? (
            <StartChecklistButton
              type={type}
              templates={templates.map((t) => ({
                id: t.id,
                name: t.name,
                stepCount: t._count.items,
              }))}
              employees={
                employees?.rows.map((e) => ({
                  id: e.id,
                  label: `${e.fullName} (${e.employeeNo})`,
                })) ?? []
              }
            />
          ) : null
        }
      />

      {instances.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={`No ${type.toLowerCase()} checklists`}
          description="Start one from an employee to track each step, who owns it, and when it was done."
        />
      ) : (
        <div className="space-y-6">
          <Section label="In progress" items={open} emptyText="Nothing in progress." />
          {closed.length > 0 ? <Section label="Closed" items={closed} /> : null}
        </div>
      )}
    </PageShell>
  );
}

function Section({
  label,
  items,
  emptyText,
}: {
  label: string;
  items: Awaited<ReturnType<typeof listChecklists>>;
  emptyText?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{label}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const pct =
              item.totalItems === 0
                ? 0
                : Math.round((item.doneItems / item.totalItems) * 100);

            return (
              <Link key={item.id} href={`/people/checklists/${item.id}`}>
                <Card className="hover:border-foreground/20 h-full gap-0 py-4 transition-colors">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.employeeName}</p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {item.employeeNo} · {item.companyCode}
                        </p>
                      </div>
                      <Badge variant={item.status === "COMPLETED" ? "valid" : "info"}>
                        {item.status === "IN_PROGRESS" ? "In progress" : "Completed"}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.templateName}</span>
                        <span className="tabular-nums">
                          {item.doneItems}/{item.totalItems}
                        </span>
                      </div>
                      <div
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${String(pct)}% complete`}
                      >
                        <div
                          className={pct === 100 ? "bg-status-valid h-full" : "bg-primary h-full"}
                          style={{ width: `${String(pct)}%` }}
                        />
                      </div>
                    </div>

                    {item.targetDate ? (
                      <p className="text-muted-foreground text-xs tabular-nums">
                        Target {item.targetDate.toISOString().slice(0, 10)}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
