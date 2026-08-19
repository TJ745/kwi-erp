"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { updateOwnNameAction } from "@/server/actions/profile";

/** The one field a user may change about themselves without an administrator. */
export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateOwnNameAction({ name: readString(fd, "name") });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Name updated.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-end gap-2">
      <div className="flex-1">
        <TextField
          name="name"
          label="Display name"
          required
          hint="How your name appears on records you create and in the audit trail."
          defaultValue={name}
          errors={errors.name}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
