"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideTransactionAction } from "@/server/actions/petty-cash";

export function ApprovalRow({
  transaction,
}: {
  transaction: {
    id: string;
    date: string;
    accountName: string;
    description: string;
    categoryName: string;
    amount: string;
    currency: string;
    type: string;
    requesterName: string | null;
    isOwnRequest: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideTransactionAction({ id: transaction.id, decision });
      if (!result.success) {
        // The overdraft refusal arrives here, and its message names the
        // balance and the amount — worth showing in full.
        toast.error(result.error);
        return;
      }
      toast.success(decision === "APPROVED" ? "Approved." : "Rejected.");
      router.refresh();
    });
  }

  return (
    <tr className="border-t">
      <td className="text-muted-foreground px-3 py-2 tabular-nums">{transaction.date}</td>
      <td className="px-3 py-2">{transaction.accountName}</td>
      <td className="px-3 py-2">
        <p>{transaction.description}</p>
        {transaction.requesterName ? (
          <p className="text-muted-foreground text-xs">for {transaction.requesterName}</p>
        ) : null}
      </td>
      <td className="text-muted-foreground px-3 py-2">{transaction.categoryName}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className={transaction.type === "EXPENSE" ? "text-status-expired" : ""}>
          {transaction.type === "EXPENSE" ? "−" : "+"}
          {transaction.amount} {transaction.currency}
        </span>
      </td>
      <td className="px-3 py-2">
        {transaction.isOwnRequest ? (
          <span className="text-muted-foreground text-xs">
            Your own request — someone else must approve it
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                decide("APPROVED");
              }}
            >
              <Check />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                decide("REJECTED");
              }}
            >
              <X />
              Reject
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
