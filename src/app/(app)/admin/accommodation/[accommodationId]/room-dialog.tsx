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
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { RECORD_STATUSES } from "@/lib/schemas/accommodation";
import { createRoomAction, updateRoomAction } from "@/server/actions/accommodation";

export type RoomValues = {
  id: string;
  accommodationId: string;
  roomNumber: string;
  floor: string | null;
  capacity: number;
  status: string;
  bedCount: number;
};

export function RoomDialog({
  accommodationId,
  room,
  open: controlledOpen,
  onOpenChange,
}: {
  accommodationId: string;
  room?: RoomValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      accommodationId,
      roomNumber: readString(fd, "roomNumber"),
      floor: readString(fd, "floor"),
      capacity: readString(fd, "capacity") || "1",
      status: readString(fd, "status"),
    };

    startTransition(async () => {
      const result = room
        ? await updateRoomAction({ ...values, id: room.id })
        : await createRoomAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(room ? "Room updated." : "Room added.");
      setOpen(false);
      router.refresh();
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
          Add room
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{room ? "Edit room" : "Add room"}</DialogTitle>
              <DialogDescription>
                Capacity is how many beds the room should hold. It caps how many bed
                records can be added; single occupancy is enforced per bed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="roomNumber"
                  label="Room number"
                  required
                  defaultValue={room?.roomNumber ?? ""}
                  errors={errors.roomNumber}
                />
                <TextField
                  name="floor"
                  label="Floor"
                  defaultValue={room?.floor ?? ""}
                  errors={errors.floor}
                />
                <TextField
                  name="capacity"
                  label="Capacity (beds)"
                  required
                  {...(room && room.bedCount > 0
                    ? { hint: `${String(room.bedCount)} bed(s) currently added.` }
                    : {})}
                  defaultValue={room ? String(room.capacity) : "1"}
                  errors={errors.capacity}
                />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  options={RECORD_STATUSES.map((s) => ({ value: s, label: s }))}
                  defaultValue={room?.status ?? "ACTIVE"}
                  errors={errors.status}
                />
              </div>
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
                {pending ? "Saving…" : room ? "Save changes" : "Add room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
