import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePagePermission } from "@/server/auth/page-guards";
import { assignableUsers, getTask } from "@/server/services/tasks";
import { orgOptions } from "@/server/services/org";
import { TaskComments } from "./task-comments";
import { TaskCreateButton } from "../task-form";

export const metadata: Metadata = { title: "Task" };

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const ctx = await requirePagePermission("tasks.view");
  const { taskId } = await params;
  const task = await getTask(ctx, taskId);

  // Editing is its own permission; the form is only fetched for actors holding it.
  const canUpdate = ctx.permissions.has("tasks.update");
  const [options, users] = await Promise.all([
    canUpdate ? orgOptions(ctx) : Promise.resolve({ companies: [] }),
    canUpdate ? assignableUsers(ctx) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <Link
        href="/tasks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to tasks
      </Link>

      <PageHeader
        title={task.title}
        description={`${task.taskNo} · ${task.company.code} · created by ${task.createdByName}`}
        action={
          <div className="flex items-center gap-2">
            {task.isOverdue ? <Badge variant="expired">Overdue</Badge> : null}
            <StatusBadge status={task.priority} />
            <StatusBadge status={task.status} />
            {canUpdate ? (
              <TaskCreateButton
                mode="edit"
                companies={options.companies}
                users={users}
                task={{
                  id: task.id,
                  taskNo: task.taskNo,
                  companyId: task.companyId,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  priority: task.priority,
                  assignedToId: task.assignedToId,
                  dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
                  followUpDate: task.followUpDate
                    ? task.followUpDate.toISOString().slice(0, 10)
                    : null,
                  entityType: task.entityType,
                  entityId: task.entityId,
                }}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {task.description ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Comments{task.comments.length > 0 ? ` (${String(task.comments.length)})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskComments
                taskId={task.id}
                comments={task.comments.map((c) => ({
                  id: c.id,
                  authorName: c.authorName,
                  body: c.body,
                  createdAt: c.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <Detail label="Assigned to" value={task.assignedToName} />
              <Detail
                label="Due date"
                value={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null}
                emphasise={task.isOverdue}
              />
              <Detail
                label="Follow-up"
                value={task.followUpDate ? task.followUpDate.toISOString().slice(0, 10) : null}
              />
              <Detail
                label="Completed"
                value={task.completedAt ? task.completedAt.toISOString().slice(0, 10) : null}
              />
              <Detail
                label="Related to"
                value={
                  task.entityType
                    ? task.entityType.replace(/_/g, " ").toLowerCase()
                    : null
                }
              />
              <Detail label="Created" value={task.createdAt.toISOString().slice(0, 10)} />
            </dl>

            {task.entityType === "EMPLOYEE" && task.entityId ? (
              <Link
                href={`/people/employees/${task.entityId}`}
                className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
              >
                Open related employee
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Detail({
  label,
  value,
  emphasise,
}: {
  label: string;
  value: string | null;
  emphasise?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={emphasise ? "text-status-expired font-medium" : ""}>
        {value ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
