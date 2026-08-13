"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteChecklistTemplateAction } from "@/server/actions/platform";

export function DeleteTemplateButton({
  id,
  name,
  instances,
}: {
  id: string;
  name: string;
  instances: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteChecklistTemplateAction({ id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted "${name}".`);
      router.refresh();
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Delete ${name}`}
      // A template that has been used is refused server-side; deactivating it
      // is the right move and the list already offers that through the editor.
      disabled={instances > 0 || pending}
      title={instances > 0 ? "In use — deactivate it instead" : undefined}
      onClick={onDelete}
    >
      <Trash2 className="text-muted-foreground size-4" />
    </Button>
  );
}
