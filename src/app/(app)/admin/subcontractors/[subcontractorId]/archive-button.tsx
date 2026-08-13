"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
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
import { deleteSubcontractorAction } from "@/server/actions/vendors";

/**
 * Archives the subcontractor. The record is kept — contracts and tasks still
 * reference it — and its contracts drop out of the expiry register, which is
 * why the count is spelled out before the actor confirms.
 */
export function SubcontractorArchiveButton({
  subcontractor,
}: {
  subcontractor: { id: string; name: string; contractCount: number };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onArchive() {
    startTransition(async () => {
      const result = await deleteSubcontractorAction({ id: subcontractor.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Archived ${subcontractor.name}.`);
      setOpen(false);
      router.push("/admin/subcontractors");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Archive />
        Archive
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive “{subcontractor.name}”?</DialogTitle>
            <DialogDescription>
              The record is kept so existing contracts and history still resolve, but it stops
              appearing in active lists
              {subcontractor.contractCount > 0
                ? `, and its ${String(subcontractor.contractCount)} contract${
                    subcontractor.contractCount === 1 ? "" : "s"
                  } will no longer raise expiry reminders.`
                : "."}
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
            <Button variant="destructive" onClick={onArchive} disabled={pending}>
              {pending ? "Archiving…" : "Archive subcontractor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
