"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BedDouble, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { BED_STATUSES } from "@/lib/schemas/accommodation";
import { createBedAction, deleteRoomAction } from "@/server/actions/accommodation";
import { RoomDialog, type RoomValues } from "./room-dialog";

export function RoomActions({ room }: { room: RoomValues }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [bedOpen, setBedOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onAddBed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createBedAction({
        roomId: room.id,
        bedLabel: readString(fd, "bedLabel"),
        status: readString(fd, "status"),
      });
      if (!result.success) {
        // Includes the capacity refusal, which names the number to change.
        setError(result.error);
        return;
      }
      toast.success("Bed added.");
      setBedOpen(false);
      router.refresh();
    });
  }

  function onDeleteRoom() {
    startTransition(async () => {
      const result = await deleteRoomAction({ id: room.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Room ${room.roomNumber} deleted.`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Actions for room ${room.roomNumber}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setBedOpen(true);
            }}
          >
            <BedDouble className="size-4" />
            Add bed
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit room
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              onDeleteRoom();
            }}
          >
            <Trash2 className="size-4" />
            Delete room
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RoomDialog
        accommodationId={room.accommodationId}
        room={room}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={bedOpen} onOpenChange={setBedOpen}>
        <DialogContent>
          <form onSubmit={onAddBed} noValidate>
            <DialogHeader>
              <DialogTitle>Add bed to room {room.roomNumber}</DialogTitle>
              <DialogDescription>
                {room.bedCount} of {room.capacity} bed{room.capacity === 1 ? "" : "s"} added so far.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {error}
                </div>
              ) : null}
              <TextField
                name="bedLabel"
                label="Bed label"
                required
                hint="For example A, B, or 1."
              />
              <SelectField
                name="status"
                label="Status"
                required
                options={BED_STATUSES.map((s) => ({
                  value: s,
                  label: s.replace(/_/g, " ").toLowerCase(),
                }))}
                defaultValue="AVAILABLE"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBedOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add bed"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
