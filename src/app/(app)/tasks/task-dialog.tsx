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
import { DateField, SelectField, TextAreaField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { DAILY_TASK_STATUS_LABELS, DAILY_TASK_STATUSES } from "@/lib/schemas/tasks";
import { createDailyTaskAction, updateDailyTaskAction } from "@/server/actions/daily-tasks";

export type TaskValues = {
  id: string;
  taskDate: string;
  description: string;
  receivedFrom: string;
  remarks: string | null;
  status: string;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Record a task received, or edit one. */
export function TaskDialog({ task, sources }: { task?: TaskValues; sources: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const listId = React.useId();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setErrors({});
      setFormError(null);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const payload = {
      taskDate: readString(fd, "taskDate"),
      description: readString(fd, "description"),
      receivedFrom: readString(fd, "receivedFrom"),
      remarks: readString(fd, "remarks"),
      status: readString(fd, "status") || "PENDING",
    };
    startTransition(async () => {
      const result = task
        ? await updateDailyTaskAction({ ...payload, id: task.id })
        : await createDailyTaskAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? "Please check the highlighted fields." : result.error);
        return;
      }
      toast.success(task ? "Task updated." : "Task recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {task ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Edit task"
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <Plus />
          New task
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              A task you received. Completed tasks stay on your list for good.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                name="taskDate"
                label="Date"
                required
                defaultValue={task?.taskDate ?? today()}
                errors={errors.taskDate}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={task?.status ?? "PENDING"}
                options={DAILY_TASK_STATUSES.map((s) => ({
                  value: s,
                  label: DAILY_TASK_STATUS_LABELS[s],
                }))}
                errors={errors.status}
              />
            </div>
            <TextAreaField
              name="description"
              label="Task"
              required
              rows={3}
              defaultValue={task?.description ?? ""}
              errors={errors.description}
            />
            <div className="space-y-1.5">
              <label htmlFor="field-receivedFrom" className="text-sm font-medium">
                Received from <span className="text-destructive">*</span>
              </label>
              <input
                id="field-receivedFrom"
                name="receivedFrom"
                list={listId}
                defaultValue={task?.receivedFrom ?? ""}
                autoComplete="off"
                aria-invalid={Boolean(errors.receivedFrom?.length)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
              <datalist id={listId}>
                {sources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {errors.receivedFrom?.[0] ? (
                <p className="text-destructive text-xs">{errors.receivedFrom[0]}</p>
              ) : null}
            </div>
            <TextAreaField
              name="remarks"
              label="Remarks"
              rows={2}
              defaultValue={task?.remarks ?? ""}
              errors={errors.remarks}
            />
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
                {pending ? "Saving…" : task ? "Save" : "Add task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
