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
import type { ActionResult } from "@/lib/result";

/** A delete icon that asks first. `action` is a server action taking { id }. */
export function DeleteRecordButton({
  id,
  label,
  action,
}: {
  id: string;
  /** What is deleted, e.g. "this joining letter". */
  label: string;
  action: (input: { id: string }) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await action({ id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Deleted.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Delete"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {label}?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
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
            <Button variant="destructive" disabled={pending} onClick={onDelete}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
