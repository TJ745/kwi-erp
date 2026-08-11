"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createCredentialAction, generatePasswordAction } from "@/server/actions/vault";

export function CredentialDialog({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState("");
  const [excludeAmbiguous, setExcludeAmbiguous] = React.useState(true);

  function generate() {
    startTransition(async () => {
      // Generated server-side so the value comes from a CSPRNG we control,
      // and the generator options are validated.
      const result = await generatePasswordAction({
        length: 24,
        symbols: true,
        digits: true,
        excludeAmbiguous,
      });
      if (result.success) setSecret(result.data.password);
      else toast.error(result.error);
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createCredentialAction({
        name: readString(fd, "name"),
        categoryId: readString(fd, "categoryId"),
        url: readString(fd, "url"),
        username: readString(fd, "username"),
        email: readString(fd, "email"),
        notes: readString(fd, "notes"),
        secret,
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success("Credential stored.");
      // Clear the plaintext from component state immediately on success.
      setSecret("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); }}>
        <Plus />
        Add credential
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Never leave a plaintext secret in state after the dialog closes.
          if (!next) setSecret("");
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add credential</DialogTitle>
            <DialogDescription>
              The password is encrypted before it is stored. It cannot be read back except
              through an explicit, recorded reveal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
              >
                {formError}
              </div>
            ) : null}

            <TextField
              name="name"
              label="Name"
              required
              placeholder="GOSI portal — KWI"
              errors={errors.name}
            />

            <SelectField
              name="categoryId"
              label="Category"
              required
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              errors={errors.categoryId}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="username" label="Username" errors={errors.username} />
              <TextField name="email" label="Email" type="email" errors={errors.email} />
            </div>

            <TextField name="url" label="URL" placeholder="https://…" errors={errors.url} />

            <div className="space-y-1.5">
              <Label htmlFor="vault-secret">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <input
                  id="vault-secret"
                  type="text"
                  value={secret}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setSecret(e.target.value);
                  }}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Generate a password"
                  disabled={pending}
                  onClick={generate}
                >
                  <RefreshCw />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ambiguous"
                  checked={excludeAmbiguous}
                  onCheckedChange={(checked) => {
                    setExcludeAmbiguous(checked === true);
                  }}
                />
                <Label htmlFor="ambiguous" className="text-xs font-normal">
                  Avoid ambiguous characters (l, I, 1, O, 0)
                </Label>
              </div>
              {errors.secret ? (
                <p className="text-destructive text-xs">{errors.secret[0]}</p>
              ) : null}
            </div>

            <TextAreaField
              name="notes"
              label="Notes"
              hint="Encrypted alongside the password."
              errors={errors.notes}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setSecret("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || secret.length === 0}>
                {pending ? "Saving…" : "Store credential"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
