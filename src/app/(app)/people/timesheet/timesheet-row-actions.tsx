"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTimesheetFileAction } from "@/server/actions/timesheets";

export function DeleteTimesheet({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Delete ${label}`}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete the ${label} timesheet? The file is removed too.`)) return;
        startTransition(async () => {
          const result = await deleteTimesheetFileAction({ id });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(`Deleted the ${label} timesheet.`);
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
