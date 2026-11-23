"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
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
import { TextAreaField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { updateSubcontractDefaultTermsAction } from "@/server/actions/vendors";

/** Edits the shared terms & conditions every new agreement starts from. */
export function DefaultTermsDialog({ terms }: { terms: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateSubcontractDefaultTermsAction({ terms: readString(fd, "terms") });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Default terms saved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ScrollText />
        Default terms
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Default terms &amp; conditions</DialogTitle>
              <DialogDescription>
                New contracts start with these terms, and you can still change them per contract.
                Saving here does not change contracts that already exist.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <TextAreaField
                name="terms"
                label="Terms"
                hint="One term per line. They print as a numbered list."
                rows={16}
                defaultValue={terms}
                errors={errors.terms}
              />
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
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
