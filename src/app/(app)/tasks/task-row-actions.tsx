"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TASK_STATUSES } from "@/lib/schemas/task";
import { deleteTaskAction, setTaskStatusAction } from "@/server/actions/tasks";

const titleCase = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function TaskRowActions({
  task,
  canDelete,
}: {
  task: { id: string; taskNo: string; title: string; status: string };
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function changeStatus(status: string) {
    startTransition(async () => {
      const result = await setTaskStatusAction({ id: task.id, status });
      if (result.success) {
        toast.success(`${task.taskNo} moved to ${titleCase(status)}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${task.taskNo}`}
            disabled={pending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="truncate">{task.taskNo}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TASK_STATUSES.filter((s) => s !== task.status).map((status) => (
            <DropdownMenuItem
              key={status}
              onSelect={() => {
                changeStatus(status);
              }}
            >
              Move to {titleCase(status)}
            </DropdownMenuItem>
          ))}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setConfirmOpen(true);
                }}
              >
                Delete task
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              “{task.title}” and its comments will be removed. The audit trail keeps a record of
              the deletion. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteTaskAction({ id: task.id });
                  if (result.success) {
                    toast.success("Task deleted.");
                    setConfirmOpen(false);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
