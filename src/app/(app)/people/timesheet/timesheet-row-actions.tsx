"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  decideTimesheetEntryAction,
  deleteTimesheetEntryAction,
} from "@/server/actions/hiring";
import { TimesheetDialog, type TimesheetValues } from "./timesheet-dialog";

export function TimesheetRowActions({
  entry,
  employees,
  canManage,
  canApprove,
}: {
  entry: TimesheetValues;
  employees: { id: string; fullName: string; employeeNo: string }[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const isPending = entry.status === "PENDING";

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideTimesheetEntryAction({ id: entry.id, decision });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "APPROVED" ? "Approved." : "Rejected.");
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteTimesheetEntryAction({ id: entry.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Entry deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Timesheet actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canApprove && isPending ? (
            <>
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => {
                  decide("APPROVED");
                }}
              >
                <Check className="size-4" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => {
                  decide("REJECTED");
                }}
              >
                <X className="size-4" />
                Reject
              </DropdownMenuItem>
            </>
          ) : null}

          {canManage ? (
            <DropdownMenuItem
              // Approved hours are signed off for payroll.
              disabled={!isPending}
              onSelect={() => {
                setEditOpen(true);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          ) : null}

          {canManage ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={entry.status === "APPROVED" || pending}
              onSelect={() => {
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <TimesheetDialog
        employees={employees}
        entry={entry}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
