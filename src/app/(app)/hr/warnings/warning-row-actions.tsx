"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { DateField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import {
  acknowledgeWarningAction,
  deleteWarningAction,
} from "@/server/actions/hr-records";
import { WarningDialog, type WarningValues } from "./warning-dialog";

export function WarningRowActions({
  warning,
  employees,
}: {
  warning: WarningValues;
  employees: { id: string; fullName: string; employeeNo: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [ackOpen, setAckOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onAcknowledge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await acknowledgeWarningAction({
        id: warning.id,
        acknowledgedAt: readString(fd, "acknowledgedAt"),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Acknowledgement recorded.");
      setAckOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteWarningAction({ id: warning.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Warning deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Warning actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!warning.acknowledged ? (
            <DropdownMenuItem
              onSelect={() => {
                setAckOpen(true);
              }}
            >
              <FileSignature className="size-4" />
              Record acknowledgement
            </DropdownMenuItem>
          ) : null}

          {/* An acknowledged warning is what the employee signed for, so both
              edit and delete are withheld rather than offered and refused. */}
          <DropdownMenuItem
            disabled={warning.acknowledged}
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={warning.acknowledged || pending}
            onSelect={() => {
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WarningDialog
        employees={employees}
        warning={warning}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={ackOpen} onOpenChange={setAckOpen}>
        <DialogContent>
          <form onSubmit={onAcknowledge} noValidate>
            <DialogHeader>
              <DialogTitle>Record acknowledgement</DialogTitle>
              <DialogDescription>
                Once recorded, this warning becomes read-only — it is the text the
                employee signed for.
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
                name="acknowledgedAt"
                label="Acknowledged on"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAckOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
