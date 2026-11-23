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
import { DateField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import {
  createEvaluationListAction,
  updateEvaluationListAction,
} from "@/server/actions/evaluations";

export type ListValues = { id: string; title: string; listDate: string; notes: string | null };

export function EvaluationListDialog({
  list,
  open: controlledOpen,
  onOpenChange,
}: {
  list?: ListValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);
    const values = {
      title: readString(fd, "title"),
      listDate: readString(fd, "listDate"),
      notes: readString(fd, "notes"),
    };
    startTransition(async () => {
      const result = list
        ? await updateEvaluationListAction({ ...values, id: list.id })
        : await createEvaluationListAction(values);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      setOpen(false);
      if (list) {
        toast.success("List updated.");
        router.refresh();
      } else {
        toast.success("List created. Now add employees to evaluate.");
        router.push(`/hr/evaluations/${result.data.id}`);
      }
    });
  }

  return (
    <>
      {!isControlled ? (
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          New evaluation list
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{list ? "Edit evaluation list" : "New evaluation list"}</DialogTitle>
              <DialogDescription>
                The title and date print at the top of the list.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <TextField
                name="title"
                label="Title"
                required
                placeholder="Annual Evaluation 2026"
                defaultValue={list?.title ?? ""}
                errors={errors.title}
              />
              <DateField
                name="listDate"
                label="Date"
                required
                defaultValue={list?.listDate ?? new Date().toISOString().slice(0, 10)}
                errors={errors.listDate}
              />
              <TextAreaField
                name="notes"
                label="Notes"
                hint="Not printed."
                rows={2}
                defaultValue={list?.notes ?? ""}
                errors={errors.notes}
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
                {pending ? "Saving…" : list ? "Save" : "Create list"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
