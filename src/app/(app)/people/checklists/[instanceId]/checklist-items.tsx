"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHECKLIST_ITEM_STATUSES } from "@/lib/schemas/hr";
import { cn } from "@/lib/utils";
import {
  completeChecklistAction,
  setChecklistItemStatusAction,
} from "@/server/actions/hr";

type Item = {
  id: string;
  order: number;
  label: string;
  category: string;
  status: string;
  notes: string | null;
  dueDate: string | null;
  completedAt: string | null;
};

const STATUS_VARIANT: Record<string, "valid" | "warning" | "expired" | "info" | "neutral"> = {
  COMPLETED: "valid",
  NOT_APPLICABLE: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "expired",
  PENDING: "warning",
};

const titleCase = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function ChecklistItems({
  instanceId,
  items,
  isOpen,
  canManage,
  blockedBy,
}: {
  instanceId: string;
  items: Item[];
  isOpen: boolean;
  canManage: boolean;
  blockedBy: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const remaining = items.filter(
    (i) => i.status !== "COMPLETED" && i.status !== "NOT_APPLICABLE",
  );
  const canComplete = isOpen && canManage && remaining.length === 0 && blockedBy.length === 0;

  function setStatus(itemId: string, status: string) {
    startTransition(async () => {
      const result = await setChecklistItemStatusAction({ itemId, status });
      if (result.success) router.refresh();
      else toast.error(result.error);
    });
  }

  function complete() {
    startTransition(async () => {
      const result = await completeChecklistAction({ instanceId });
      if (result.success) {
        toast.success("Checklist completed.");
        router.refresh();
      } else {
        // The server re-checks the blockers, so this covers anything that
        // changed since the page was rendered.
        toast.error(result.error);
      }
    });
  }

  // Group by responsible department — this is what turns the offboarding list
  // into a clearance form (brief §15).
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([category, groupItems]) => (
        <Card key={category}>
          <CardContent className="space-y-1 px-4 py-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              {titleCase(category)}
            </p>
            <ul className="divide-y">
              {groupItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        (item.status === "COMPLETED" || item.status === "NOT_APPLICABLE") &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {item.label}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {item.completedAt
                        ? `Done ${item.completedAt}`
                        : item.dueDate
                          ? `Due ${item.dueDate}`
                          : ""}
                    </p>
                  </div>

                  {isOpen && canManage ? (
                    <Select
                      value={item.status}
                      disabled={pending}
                      onValueChange={(value) => {
                        setStatus(item.id, value);
                      }}
                    >
                      <SelectTrigger
                        className="w-44 shrink-0"
                        aria-label={`Status for ${item.label}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECKLIST_ITEM_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {titleCase(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={STATUS_VARIANT[item.status] ?? "neutral"}>
                      {titleCase(item.status)}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {isOpen && canManage ? (
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <p className="text-muted-foreground text-sm">
            {remaining.length === 0
              ? blockedBy.length === 0
                ? "All steps done. This checklist can be completed."
                : `${String(blockedBy.length)} outstanding item(s) still block completion.`
              : `${String(remaining.length)} step(s) remaining.`}
          </p>
          <Button disabled={!canComplete || pending} onClick={complete}>
            {pending ? "Completing…" : "Mark complete"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
