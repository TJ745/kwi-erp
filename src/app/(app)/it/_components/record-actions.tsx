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
import type { ActionResult } from "@/lib/result";
import { RecordDialog, type FieldSpec, type RecordValues } from "./record-dialog";

/** Edit + delete for one infrastructure row, sharing the generic dialog. */
export function RecordActions({
  title,
  description,
  fields,
  values,
  submit,
  remove,
  label,
}: {
  title: string;
  description: string;
  fields: readonly FieldSpec[];
  values: RecordValues;
  submit: (
    data: Record<string, string | boolean>,
    id: string | undefined,
  ) => Promise<ActionResult<unknown>>;
  remove: (id: string) => Promise<ActionResult<unknown>>;
  label: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    const id = typeof values.id === "string" ? values.id : "";
    startTransition(async () => {
      const result = await remove(id);
      if (!result.success) {
        // Carries the refusals — a device with IPs, a recorder with cameras.
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${label}.`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${label}`}>
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

      <RecordDialog
        title={title}
        description={description}
        triggerLabel=""
        fields={fields}
        values={values}
        submit={submit}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
