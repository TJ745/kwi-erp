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
import { deleteJobDescriptionAction } from "@/server/actions/hiring";
import { JobDescriptionDialog, type JobDescriptionValues } from "./job-description-dialog";

export function JobDescriptionRowActions({
  description,
  companies,
  positions,
}: {
  description: JobDescriptionValues;
  companies: { id: string; code: string; name: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteJobDescriptionAction({ id: description.id });
      if (!result.success) {
        // Includes the refusal when offers reference it.
        toast.error(result.error);
        return;
      }
      toast.success("Description deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Description actions">
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
            // Offers quote this text; deactivating keeps them readable.
            disabled={description.offerCount > 0 || pending}
            onSelect={() => {
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <JobDescriptionDialog
        companies={companies}
        positions={positions}
        description={description}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
