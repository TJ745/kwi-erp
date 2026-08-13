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
  decideIncrementAction,
  deleteIncrementAction,
} from "@/server/actions/hr-records";
import { IncrementDialog, type IncrementValues } from "./increment-dialog";

export function IncrementRowActions({
  increment,
  employees,
  canManage,
  canApprove,
}: {
  increment: IncrementValues;
  employees: { id: string; fullName: string; employeeNo: string }[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const isPending = increment.status === "PENDING";
  // Same separation of duties as petty cash: the requester cannot decide.
  const mayDecide = canApprove && isPending && !increment.isOwnRequest;

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideIncrementAction({ id: increment.id, decision });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "APPROVED"
          ? "Approved — the contract now shows the new salary."
          : "Rejected.",
      );
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteIncrementAction({ id: increment.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Increment deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Increment actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {mayDecide ? (
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

          {canApprove && isPending && increment.isOwnRequest ? (
            <DropdownMenuItem disabled>
              Your own request — someone else must approve
            </DropdownMenuItem>
          ) : null}

          {canManage ? (
            <DropdownMenuItem
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
              // An approved increment has already moved the contract.
              disabled={increment.status === "APPROVED" || pending}
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

      <IncrementDialog
        employees={employees}
        increment={increment}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
