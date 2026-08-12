"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createProviderAction } from "@/server/actions/insurance";

export function ProviderDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createProviderAction({
        name: readString(fd, "name"),
        contactPerson: readString(fd, "contactPerson"),
        phone: readString(fd, "phone"),
        email: readString(fd, "email"),
        isActive: true,
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success("Provider added.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); }}>
        <Building2 />
        Add provider
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Add insurance provider</DialogTitle>
              <DialogDescription>
                Providers are shared across companies, so add each one only once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              <TextField name="name" label="Provider name" required errors={errors.name} />
              <TextField
                name="contactPerson"
                label="Contact person"
                errors={errors.contactPerson}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="phone" label="Phone" errors={errors.phone} />
                <TextField name="email" label="Email" type="email" errors={errors.email} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add provider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
