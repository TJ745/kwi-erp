"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setDailyTaskStatusAction } from "@/server/actions/daily-tasks";

/** One click marks a task done; another reopens it. */
export function TaskDoneToggle({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Mark as pending" : "Mark as completed"}
      title={done ? "Completed — click to reopen" : "Mark as completed"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await setDailyTaskStatusAction({
            id,
            status: done ? "PENDING" : "COMPLETED",
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          router.refresh();
        });
      }}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50",
        done
          ? "border-status-valid bg-status-valid text-white"
          : "border-input hover:border-foreground/40",
      )}
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </button>
  );
}
