import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePageAnyPermission } from "@/server/auth/page-guards";
import { getChecklist, outstandingForEmployee } from "@/server/services/checklists";
import { ChecklistItems } from "./checklist-items";

export const metadata: Metadata = { title: "Checklist" };

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const ctx = await requirePageAnyPermission([
    "hr.onboarding.view",
    "hr.offboarding.view",
  ]);
  const { instanceId } = await params;
  const instance = await getChecklist(ctx, instanceId);

  const canManage = ctx.permissions.has(
    instance.type === "OFFBOARDING" ? "hr.offboarding.manage" : "hr.onboarding.manage",
  );

  // Only offboarding is gated on outstanding property — that is the rule from
  // brief §50 that stops a leaver being marked cleared while holding a laptop.
  const outstanding =
    instance.type === "OFFBOARDING"
      ? await outstandingForEmployee(ctx, instance.employeeId, instance.id)
      : null;

  const backHref =
    instance.type === "OFFBOARDING" ? "/people/offboarding" : "/people/onboarding";

  const done = instance.items.filter(
    (i) => i.status === "COMPLETED" || i.status === "NOT_APPLICABLE",
  ).length;

  const blockers = outstanding
    ? [
        ...outstanding.unreturnedAssets.map(
          (a) => `${a.assetCode} — ${a.brand} ${a.model} not returned`,
        ),
        ...outstanding.activeAccommodation.map((a) => `Accommodation: ${a.label}`),
        ...outstanding.openTasks.map((t) => `Open task ${t.taskNo}: ${t.title}`),
      ]
    : [];

  return (
    <PageShell>
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to {instance.type.toLowerCase()}
      </Link>

      <PageHeader
        title={instance.employee.fullName}
        description={`${instance.template.name} · ${instance.employee.employeeNo} · started ${instance.startedAt.toISOString().slice(0, 10)}`}
        action={
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm tabular-nums">
              {done}/{instance.items.length}
            </span>
            <Badge variant={instance.status === "COMPLETED" ? "valid" : "info"}>
              {instance.status === "IN_PROGRESS" ? "In progress" : "Completed"}
            </Badge>
          </div>
        }
      />

      {blockers.length > 0 && instance.status === "IN_PROGRESS" ? (
        <Card className="border-status-warning/40">
          <CardHeader>
            <CardTitle className="text-status-warning flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4" />
              Outstanding before this can be completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ChecklistItems
        instanceId={instance.id}
        isOpen={instance.status === "IN_PROGRESS"}
        canManage={canManage}
        blockedBy={blockers}
        items={instance.items.map((item) => ({
          id: item.id,
          order: item.order,
          label: item.label,
          category: item.category,
          status: item.status,
          notes: item.notes,
          dueDate: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : null,
          completedAt: item.completedAt ? item.completedAt.toISOString().slice(0, 10) : null,
        }))}
      />
    </PageShell>
  );
}
