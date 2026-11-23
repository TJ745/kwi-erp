"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deleteEvaluationAction } from "@/server/actions/evaluations";

export function RemoveEvaluation({
  id,
  label,
  afterDelete,
}: {
  id: string;
  label: string;
  afterDelete?: string | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteEvaluationAction({ id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Evaluation removed.");
      setOpen(false);
      if (afterDelete) router.push(afterDelete);
      else router.refresh();
    });
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Remove ${label}`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {label}?</DialogTitle>
            <DialogDescription>
              The filled form is deleted from this list. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
