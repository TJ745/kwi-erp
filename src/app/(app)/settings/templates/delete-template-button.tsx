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
import { deleteTemplateAction } from "@/server/actions/letters";

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteTemplateAction({ id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted "${name}".`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Delete ${name}`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 className="text-muted-foreground size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{name}”?</DialogTitle>
            <DialogDescription>
              Letters already generated from this template keep their own frozen copy and are
              unaffected. The template stops being available for new letters.
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
            <Button variant="destructive" onClick={onConfirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
