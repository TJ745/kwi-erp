"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/schemas/task";
import { createTaskAction } from "@/server/actions/tasks";

type Company = { id: string; code: string; name: string };
type User = { id: string; name: string; email: string };

const titleCase = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function TaskCreateButton({
  companies,
  users,
  defaultEntity,
}: {
  companies: Company[];
  users: User[];
  /** Pre-links the task to a record when opened from that record's page. */
  defaultEntity?: { entityType: string; entityId: string; companyId: string } | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createTaskAction({
        companyId: readString(fd, "companyId") || (defaultEntity?.companyId ?? ""),
        title: readString(fd, "title"),
        description: readString(fd, "description"),
        status: readString(fd, "status") || "TODO",
        priority: readString(fd, "priority") || "MEDIUM",
        assignedToId: readString(fd, "assignedToId"),
        dueDate: readString(fd, "dueDate"),
        followUpDate: readString(fd, "followUpDate"),
        ...(defaultEntity
          ? { entityType: defaultEntity.entityType, entityId: defaultEntity.entityId }
          : {}),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(`Task ${result.data.taskNo} created.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); }}>
        <Plus />
        New task
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              A task number is generated automatically. Tasks past their due date are shown as
              overdue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <TextField name="title" label="Title" required errors={errors.title} />
            <TextAreaField name="description" label="Description" errors={errors.description} />

            <div className="grid gap-4 sm:grid-cols-2">
              {defaultEntity ? null : (
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  defaultValue={companies[0]?.id ?? ""}
                  options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                  errors={errors.companyId}
                />
              )}
              <SelectField
                name="assignedToId"
                label="Assign to"
                defaultValue="none"
                options={[
                  { value: "none", label: "— Unassigned —" },
                  ...users.map((u) => ({ value: u.id, label: u.name })),
                ]}
                errors={errors.assignedToId}
              />
              <SelectField
                name="priority"
                label="Priority"
                defaultValue="MEDIUM"
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }))}
                errors={errors.priority}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue="TODO"
                options={TASK_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
                errors={errors.status}
              />
              <DateField name="dueDate" label="Due date" errors={errors.dueDate} />
              <DateField
                name="followUpDate"
                label="Follow-up date"
                errors={errors.followUpDate}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
