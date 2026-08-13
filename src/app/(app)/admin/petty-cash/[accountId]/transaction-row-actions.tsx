"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, MoreHorizontal, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelTransactionAction,
  decideTransactionAction,
} from "@/server/actions/petty-cash";
import { TransactionDialog, type TransactionValues } from "./transaction-dialog";

export function TransactionRowActions({
  transaction,
  currency,
  categories,
  employees,
  canApprove,
  canEdit,
}: {
  transaction: TransactionValues;
  currency: string;
  categories: { id: string; name: string; type: string }[];
  employees: { id: string; fullName: string; employeeNo: string }[];
  canApprove: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideTransactionAction({ id: transaction.id, decision });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "APPROVED" ? "Approved." : "Rejected.");
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelTransactionAction({ id: transaction.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Request cancelled.");
      router.refresh();
    });
  }

  // Approval is offered only when the actor holds the permission AND did not
  // raise the request — the server refuses self-approval either way, but an
  // offered button that always fails is worse than no button.
  const mayDecide = canApprove && !transaction.isOwnRequest;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Transaction actions">
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

          {canEdit ? (
            <DropdownMenuItem
              onSelect={() => {
                setEditOpen(true);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          ) : null}

          {canEdit ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={() => {
                cancel();
              }}
            >
              <Ban className="size-4" />
              Cancel request
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <TransactionDialog
        accountId={transaction.accountId}
        currency={currency}
        categories={categories}
        employees={employees}
        transaction={transaction}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
