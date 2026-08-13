"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { deleteSupplierAction } from "@/server/actions/vendors";
import { SupplierDialog } from "./supplier-dialog";
import type { SupplierValues } from "./supplier-form-fields";

export function SupplierRowActions({
  supplier,
  companies,
  categories,
}: {
  supplier: SupplierValues;
  companies: { id: string; code: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteSupplierAction({ id: supplier.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Archived ${supplier.name}.`);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${supplier.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SupplierDialog
        companies={companies}
        categories={categories}
        supplier={supplier}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive “{supplier.name}”?</DialogTitle>
            <DialogDescription>
              The record is kept — purchase history elsewhere still references it — but the
              supplier stops appearing in active lists.
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
              {pending ? "Archiving…" : "Archive supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
