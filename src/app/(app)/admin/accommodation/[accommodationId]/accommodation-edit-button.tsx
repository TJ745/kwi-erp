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
import { deleteAccommodationAction } from "@/server/actions/accommodation";
import { AccommodationDialog, type AccommodationValues } from "../accommodation-dialog";

export function AccommodationEditButton({
  accommodation,
  companies,
}: {
  accommodation: AccommodationValues;
  companies: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccommodationAction({ id: accommodation.id });
      if (!result.success) {
        // The occupied-property refusal lands here and names the count.
        setError(result.error);
        return;
      }
      toast.success(`Deleted ${accommodation.name}.`);
      router.push("/admin/accommodation");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <MoreHorizontal />
            Manage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit property
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete property
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccommodationDialog
        companies={companies}
        accommodation={accommodation}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{accommodation.name}”?</DialogTitle>
            <DialogDescription>
              Its rooms and beds go with it. A property with anyone still checked in cannot be
              deleted — check them out first.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
            >
              {error}
            </div>
          ) : null}

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
              {pending ? "Deleting…" : "Delete property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
