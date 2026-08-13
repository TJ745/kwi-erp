"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, MoreHorizontal, Pencil, Trash2, User } from "lucide-react";
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
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { BED_STATUSES } from "@/lib/schemas/accommodation";
import { cn } from "@/lib/utils";
import {
  checkInAction,
  checkOutAction,
  deleteBedAction,
  updateBedAction,
} from "@/server/actions/accommodation";

type Bed = {
  id: string;
  roomId: string;
  bedLabel: string;
  status: string;
  occupant: {
    assignmentId: string;
    employeeName: string;
    employeeNo: string;
    checkInDate: string;
  } | null;
};

/**
 * One bed, showing who is in it.
 *
 * The check-in dialog only lists employees who are not currently housed — the
 * service refuses to put someone in two beds, and offering the option would
 * just produce a failed submit.
 */
export function BedCell({
  bed,
  employees,
  canManage,
}: {
  bed: Bed;
  employees: { id: string; fullName: string; employeeNo: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [checkInOpen, setCheckInOpen] = React.useState(false);
  const [checkOutOpen, setCheckOutOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const occupied = bed.occupant !== null;
  const outOfService = bed.status === "OUT_OF_SERVICE";

  function onCheckIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await checkInAction({
        bedId: bed.id,
        employeeId: readString(fd, "employeeId"),
        checkInDate: readString(fd, "checkInDate"),
        notes: readString(fd, "notes"),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Checked in.");
      setCheckInOpen(false);
      router.refresh();
    });
  }

  function onCheckOut(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    // Captured before the transition: narrowing from the guard above does not
    // survive into the async closure, and `bed` could be a new object by then.
    const occupant = bed.occupant;
    if (!occupant) return;
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await checkOutAction({
        id: occupant.assignmentId,
        checkOutDate: readString(fd, "checkOutDate"),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Checked out.");
      setCheckOutOpen(false);
      router.refresh();
    });
  }

  function onEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBedAction({
        id: bed.id,
        roomId: bed.roomId,
        bedLabel: readString(fd, "bedLabel"),
        status: readString(fd, "status"),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Bed updated.");
      setEditOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteBedAction({ id: bed.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Bed removed.");
      router.refresh();
    });
  }

  return (
    <>
      <div
        className={cn(
          "rounded-lg border p-3",
          occupied && "border-foreground/20 bg-muted/30",
          outOfService && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">Bed {bed.bedLabel}</p>

            {occupied && bed.occupant ? (
              <div className="mt-1 flex items-start gap-1.5">
                <User
                  className="text-muted-foreground mt-0.5 size-3 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {bed.occupant.employeeName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    since {bed.occupant.checkInDate}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                {outOfService ? "Out of service" : "Available"}
              </p>
            )}
          </div>

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label={`Actions for bed ${bed.bedLabel}`}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!occupied && !outOfService ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setCheckInOpen(true);
                    }}
                  >
                    <LogIn className="size-4" />
                    Check in
                  </DropdownMenuItem>
                ) : null}
                {occupied ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setCheckOutOpen(true);
                    }}
                  >
                    <LogOut className="size-4" />
                    Check out
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                  Edit bed
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={occupied}
                  onSelect={() => {
                    onDelete();
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove bed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent>
          <form onSubmit={onCheckIn} noValidate>
            <DialogHeader>
              <DialogTitle>Check in to bed {bed.bedLabel}</DialogTitle>
              <DialogDescription>
                Only employees who are not already housed are listed — one person, one
                bed.
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

              {employees.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Every active employee in this company is already housed.
                </p>
              ) : (
                <>
                  <SelectField
                    name="employeeId"
                    label="Employee"
                    required
                    options={employees.map((e) => ({
                      value: e.id,
                      label: `${e.fullName} · ${e.employeeNo}`,
                    }))}
                  />
                  <DateField
                    name="checkInDate"
                    label="Check-in date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <TextAreaField name="notes" label="Notes" />
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCheckInOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || employees.length === 0}>
                {pending ? "Checking in…" : "Check in"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={checkOutOpen} onOpenChange={setCheckOutOpen}>
        <DialogContent>
          <form onSubmit={onCheckOut} noValidate>
            <DialogHeader>
              <DialogTitle>Check out {bed.occupant?.employeeName}</DialogTitle>
              <DialogDescription>
                This frees bed {bed.bedLabel} for the next occupant. The stay stays on
                record.
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
              <DateField
                name="checkOutDate"
                label="Check-out date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCheckOutOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Checking out…" : "Check out"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={onEdit} noValidate>
            <DialogHeader>
              <DialogTitle>Edit bed {bed.bedLabel}</DialogTitle>
              <DialogDescription>
                An occupied bed cannot be taken out of service.
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
                defaultValue={bed.bedLabel}
              />
              <SelectField
                name="status"
                label="Status"
                required
                options={BED_STATUSES.map((s) => ({
                  value: s,
                  label: s.replace(/_/g, " ").toLowerCase(),
                }))}
                defaultValue={bed.status}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
