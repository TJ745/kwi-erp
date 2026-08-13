"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  decideEvaluationAction,
  deleteEvaluationAction,
} from "@/server/actions/hr-records";

/**
 * Editing needs the evaluation's criteria, which the list does not carry.
 * Rather than ship every score to every row, the edit path is left to the
 * approve/reject and delete decisions here — a review is restated wholesale
 * when it changes, and that is a rare enough event to open the record for.
 */
export function EvaluationRowActions({
  evaluationId,
  status,
  employees: _employees,
}: {
  evaluationId: string;
  status: string;
  employees: { id: string; fullName: string; employeeNo: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const isPending = status === "PENDING";

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideEvaluationAction({ id: evaluationId, decision });
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
      const result = await deleteEvaluationAction({ id: evaluationId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Evaluation deleted.");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Evaluation actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isPending ? (
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
        <DropdownMenuItem
          variant="destructive"
          // An approved evaluation is part of the employee's record.
          disabled={status === "APPROVED" || pending}
          onSelect={() => {
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
