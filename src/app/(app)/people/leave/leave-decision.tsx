"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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
import { TextAreaField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { cancelLeaveRequestAction, decideLeaveRequestAction } from "@/server/actions/hr";

/**
 * Approve / reject / cancel controls.
 *
 * Only PENDING requests can be decided, and only PENDING or APPROVED can be
 * cancelled — mirroring the server-side state machine, so the UI never offers
 * an action the server would refuse.
 */
export function LeaveDecision({
  request,
  canApprove,
  canCancel,
}: {
  request: { id: string; employeeName: string; status: string; days: string };
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const isPending = request.status === "PENDING";
  const isCancellable = isPending || request.status === "APPROVED";

  function approve() {
    startTransition(async () => {
      const result = await decideLeaveRequestAction({
        id: request.id,
        decision: "APPROVED",
      });
      if (result.success) {
        toast.success(`Leave approved for ${request.employeeName}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function reject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await decideLeaveRequestAction({
        id: request.id,
        decision: "REJECTED",
        comment: readString(fd, "comment"),
      });
      if (result.success) {
        toast.success("Leave rejected.");
        setRejectOpen(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelLeaveRequestAction({ id: request.id });
      if (result.success) {
        toast.success("Leave cancelled.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!isPending && !isCancellable) return null;

  return (
    <div className="flex justify-end gap-1">
      {isPending && canApprove ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Approve leave for ${request.employeeName}`}
            disabled={pending}
            onClick={approve}
          >
            <Check className="text-status-valid" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Reject leave for ${request.employeeName}`}
            disabled={pending}
            onClick={() => {
              setRejectOpen(true);
            }}
          >
            <X className="text-status-expired" />
          </Button>
        </>
      ) : null}

      {isCancellable && canCancel ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={cancel}>
          Cancel
        </Button>
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <form onSubmit={reject} noValidate>
            <DialogHeader>
              <DialogTitle>Reject this leave request?</DialogTitle>
              <DialogDescription>
                {request.employeeName} · {request.days} day(s). A reason is required and is
                recorded in the audit trail.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <TextAreaField
                name="comment"
                label="Reason for rejection"
                required
                errors={errors.comment}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectOpen(false);
                }}
              >
                Back
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Rejecting…" : "Reject"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
