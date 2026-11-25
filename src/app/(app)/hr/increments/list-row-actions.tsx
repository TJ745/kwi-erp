"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteIncrementListAction } from "@/server/actions/increments";
import { IncrementListDialog, type ListValues } from "./list-dialog";

export function IncrementListRowActions({
  list,
  canManage,
  afterDelete,
}: {
  list: ListValues;
  canManage: boolean;
  /** Where to go once deleted; defaults to staying on the page. */
  afterDelete?: string | undefined;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteIncrementListAction({ id: list.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("List deleted.");
      setDeleteOpen(false);
      if (afterDelete) router.push(afterDelete);
      else router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${list.title}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/hr/increments/${list.id}/print`} target="_blank" rel="noopener">
              <Printer className="size-4" />
              Print list
            </Link>
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  setEditOpen(true);
                }}
              >
                <Pencil className="size-4" />
                Edit title / date
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-4" />
                Delete list
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage ? (
        <>
          <IncrementListDialog list={list} open={editOpen} onOpenChange={setEditOpen} />
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete “{list.title}”?</DialogTitle>
                <DialogDescription>
                  The list and every employee line on it are removed. Employees&apos; own salaries
                  are not affected. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={onDelete} disabled={pending}>
                  {pending ? "Deleting…" : "Delete list"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
