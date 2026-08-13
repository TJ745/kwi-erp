"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";

type Company = { id: string; code: string; name: string };
type User = { id: string; name: string; email: string };

export type EditableTask = {
  id: string;
  taskNo: string;
  companyId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedToId: string | null;
  dueDate: string | null;
  followUpDate: string | null;
  entityType: string | null;
  entityId: string | null;
};

const titleCase = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function TaskCreateButton({
  mode = "create",
  companies,
  users,
  defaultEntity,
  task,
}: {
  mode?: "create" | "edit";
  companies: Company[];
  users: User[];
  /** Pre-links the task to a record when opened from that record's page. */
  defaultEntity?: { entityType: string; entityId: string; companyId: string } | undefined;
  task?: EditableTask | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const isEdit = mode === "edit";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    // The service writes entityType/entityId as `?? null`, so an edit that
    // omitted them would silently unlink the task from the record it belongs
    // to. They are carried through unchanged unless a new link was supplied.
    const entityLink = defaultEntity
      ? { entityType: defaultEntity.entityType, entityId: defaultEntity.entityId }
      : isEdit && task?.entityType && task.entityId
        ? { entityType: task.entityType, entityId: task.entityId }
        : {};

    const payload = {
      companyId:
        readString(fd, "companyId") || defaultEntity?.companyId || task?.companyId || "",
      title: readString(fd, "title"),
      description: readString(fd, "description"),
      status: readString(fd, "status") || "TODO",
      priority: readString(fd, "priority") || "MEDIUM",
      assignedToId: readString(fd, "assignedToId"),
      dueDate: readString(fd, "dueDate"),
      followUpDate: readString(fd, "followUpDate"),
      ...entityLink,
    };

    startTransition(async () => {
      // Create and update are handled in separate branches rather than through
      // one union: only the create result carries the generated task number.
      if (isEdit && task) {
        const result = await updateTaskAction({ ...payload, id: task.id });
        if (!result.success) {
          setErrors(result.fieldErrors ?? {});
          if (!result.fieldErrors) toast.error(result.error);
          return;
        }
        toast.success(`Task ${task.taskNo} updated.`);
      } else {
        const result = await createTaskAction(payload);
        if (!result.success) {
          setErrors(result.fieldErrors ?? {});
          if (!result.fieldErrors) toast.error(result.error);
          return;
        }
        toast.success(`Task ${result.data.taskNo} created.`);
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={isEdit ? "outline" : "default"}
        onClick={() => {
          setOpen(true);
        }}
      >
        {isEdit ? (
          <>
            <Pencil />
            Edit
          </>
        ) : (
          <>
            <Plus />
            New task
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${task?.taskNo ?? "task"}` : "New task"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "The task number and the record this task is linked to do not change."
                : "A task number is generated automatically. Tasks past their due date are shown as overdue."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <TextField
              name="title"
              label="Title"
              required
              defaultValue={task?.title ?? ""}
              errors={errors.title}
            />
            <TextAreaField
              name="description"
              label="Description"
              defaultValue={task?.description ?? ""}
              errors={errors.description}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {defaultEntity ? null : (
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  defaultValue={task?.companyId ?? companies[0]?.id ?? ""}
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  errors={errors.companyId}
                />
              )}
              <SelectField
                name="assignedToId"
                label="Assign to"
                defaultValue={task?.assignedToId ?? "none"}
                options={[
                  { value: "none", label: "— Unassigned —" },
                  ...users.map((u) => ({ value: u.id, label: u.name })),
                ]}
                errors={errors.assignedToId}
              />
              <SelectField
                name="priority"
                label="Priority"
                defaultValue={task?.priority ?? "MEDIUM"}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }))}
                errors={errors.priority}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={task?.status ?? "TODO"}
                options={TASK_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
                errors={errors.status}
              />
              <DateField
                name="dueDate"
                label="Due date"
                defaultValue={task?.dueDate ?? ""}
                errors={errors.dueDate}
              />
              <DateField
                name="followUpDate"
                label="Follow-up date"
                defaultValue={task?.followUpDate ?? ""}
                errors={errors.followUpDate}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
