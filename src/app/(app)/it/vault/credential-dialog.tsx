"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RefreshCw } from "lucide-react";
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
import {
  createCredentialAction,
  generatePasswordAction,
  updateCredentialAction,
} from "@/server/actions/vault";

type Company = { id: string; code: string; name: string };

export type EditableCredential = {
  id: string;
  name: string;
  categoryId: string;
  companyId: string | null;
  username: string | null;
  email: string | null;
  url: string | null;
};

/**
 * Create and edit a credential.
 *
 * Editing never pre-fills the password or the notes — neither can be read back
 * without an explicit, recorded reveal, so the form cannot show them. Both
 * fields therefore mean "leave as it is" when left blank, and entering a
 * password rotates it (the previous ciphertext is kept as history, still
 * encrypted). The form says so, because a blank field that silently wipes data
 * is worse than no field.
 */
export function CredentialDialog({
  mode,
  categories,
  companies,
  credential,
}: {
  mode: "create" | "edit";
  categories: { id: string; name: string }[];
  companies: Company[];
  credential?: EditableCredential;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState("");
  const [excludeAmbiguous, setExcludeAmbiguous] = React.useState(true);

  const isEdit = mode === "edit";

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

    const fields = {
      name: readString(fd, "name"),
      categoryId: readString(fd, "categoryId"),
      companyId: readString(fd, "companyId"),
      url: readString(fd, "url"),
      username: readString(fd, "username"),
      email: readString(fd, "email"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result =
        isEdit && credential
          ? await updateCredentialAction({
              ...fields,
              id: credential.id,
              // Omitted entirely when blank, so the stored secret is untouched.
              ...(secret ? { secret } : {}),
            })
          : await createCredentialAction({ ...fields, secret });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(
        isEdit
          ? secret
            ? "Credential updated and password rotated."
            : "Credential updated."
          : "Credential stored.",
      );
      // Clear the plaintext from component state immediately on success.
      setSecret("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size={isEdit ? "icon-sm" : "sm"}
        variant={isEdit ? "ghost" : "default"}
        aria-label={isEdit ? `Edit ${credential?.name ?? ""}` : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        {isEdit ? (
          <Pencil />
        ) : (
          <>
            <Plus />
            Add credential
          </>
        )}
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
            <DialogTitle>{isEdit ? "Edit credential" : "Add credential"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Leave the password blank to keep the current one. Entering a new password rotates it and keeps the old value in encrypted history."
                : "The password is encrypted before it is stored. It cannot be read back except through an explicit, recorded reveal."}
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
              defaultValue={credential?.name ?? ""}
              errors={errors.name}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="categoryId"
                label="Category"
                required
                defaultValue={credential?.categoryId ?? ""}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                errors={errors.categoryId}
              />

              <SelectField
                name="companyId"
                label="Company"
                hint="Shared credentials are visible to every company you can access."
                defaultValue={credential?.companyId ?? companies[0]?.id ?? "none"}
                options={[
                  ...companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
                  { value: "none", label: "— Shared across companies —" },
                ]}
                errors={errors.companyId}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="username"
                label="Username"
                defaultValue={credential?.username ?? ""}
                errors={errors.username}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                defaultValue={credential?.email ?? ""}
                errors={errors.email}
              />
            </div>

            <TextField
              name="url"
              label="URL"
              placeholder="https://…"
              defaultValue={credential?.url ?? ""}
              errors={errors.url}
            />

            <div className="space-y-1.5">
              <Label htmlFor="vault-secret">
                Password {isEdit ? null : <span className="text-destructive">*</span>}
              </Label>
              <div className="flex gap-2">
                <input
                  id="vault-secret"
                  type="text"
                  value={secret}
                  required={!isEdit}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={isEdit ? "Leave blank to keep the current password" : ""}
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
              hint={
                isEdit
                  ? "Encrypted, so existing notes cannot be shown. Leave blank to keep them; anything entered replaces them."
                  : "Encrypted alongside the password."
              }
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
              <Button type="submit" disabled={pending || (!isEdit && secret.length === 0)}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Store credential"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
