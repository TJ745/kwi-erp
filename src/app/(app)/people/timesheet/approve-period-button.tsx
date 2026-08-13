"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approvePeriodAction } from "@/server/actions/hiring";

/**
 * End-of-month bulk approval.
 *
 * Only offered when a single employee is selected: approving "everyone's
 * pending hours for March" in one click is exactly the action somebody regrets.
 */
export function ApprovePeriodButton({
  employeeId,
  from,
  to,
}: {
  employeeId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onApprove() {
    startTransition(async () => {
      const result = await approvePeriodAction({ employeeId, from, to });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Approved ${String(result.data.approved)} day(s).`);
      router.refresh();
    });
  }

  return (
    <div className="border-status-warning/40 bg-status-warning/5 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <p className="text-sm">
        This period has hours awaiting approval for the selected employee.
      </p>
      <Button size="sm" disabled={pending} onClick={onApprove}>
        <CheckCheck />
        {pending ? "Approving…" : `Approve ${from} → ${to}`}
      </Button>
    </div>
  );
}
