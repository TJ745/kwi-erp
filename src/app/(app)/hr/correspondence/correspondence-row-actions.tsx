"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCorrespondenceAction } from "@/server/actions/hr-records";
import {
  CorrespondenceDialog,
  type CorrespondenceValues,
} from "./correspondence-dialog";

export function CorrespondenceRowActions({
  item,
  companies,
  employees,
}: {
  item: CorrespondenceValues;
  companies: { id: string; code: string; name: string }[];
  employees: { id: string; fullName: string; employeeNo: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteCorrespondenceAction({ id: item.id });
      if (!result.success) {
        // Includes the refusal when an Iqama renewal references it.
        toast.error(result.error);
        return;
      }
      toast.success("Correspondence deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Correspondence actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CorrespondenceDialog
        companies={companies}
        employees={employees}
        item={item}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
