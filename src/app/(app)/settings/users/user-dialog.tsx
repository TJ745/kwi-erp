"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createUserAction } from "@/server/actions/users";

type Option = { id: string; label: string };

/**
 * Creating a user account.
 *
 * The password is typed once, by the administrator, and is only ever a
 * stopgap: the account is created with `mustChangePassword`, and the app
 * layout redirects to /change-password until it is replaced. It is shown in
 * plain text on purpose — an administrator who cannot read what they typed
 * hands over a password that does not work, and hiding it protects nobody at
 * the moment it is being written down anyway.
 */
export function UserDialog({
  roles,
  companies,
  employees,
}: {
  roles: Option[];
  companies: Option[];
  /** Employees with no account yet; linking is optional. */
  employees: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [companyIds, setCompanyIds] = React.useState<string[]>([]);
  const [password, setPassword] = React.useState("");
  // Bumped to remount the password field when a suggestion replaces its value.
  const [suggestionId, setSuggestionId] = React.useState(0);

  function suggestPassword() {
    // Generated in the browser and never sent anywhere but the form: this is a
    // convenience so the administrator does not reach for "Welcome123", not a
    // security control.
    const bytes = new Uint32Array(4);
    crypto.getRandomValues(bytes);
    const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (const n of bytes) {
      let v = n;
      for (let i = 0; i < 4; i += 1) {
        out += alphabet[v % alphabet.length];
        v = Math.floor(v / alphabet.length);
      }
    }
    setPassword(out);
    setSuggestionId((n) => n + 1);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    const payload = {
      email: readString(fd, "email"),
      name: readString(fd, "name"),
      roleId: readString(fd, "roleId"),
      temporaryPassword: readString(fd, "temporaryPassword"),
      companyIds,
      employeeId: readString(fd, "employeeId"),
    };

    startTransition(async () => {
      const result = await createUserAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("User created. They must change the password at first sign-in.");
      setOpen(false);
      setCompanyIds([]);
      setPassword("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus />
        Add user
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              The account is created with a temporary password. They will be asked to
              change it the first time they sign in.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="name"
                label="Full name"
                required
                errors={errors.name}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                required
                hint="Used to sign in."
                errors={errors.email}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  {/*
                    Uncontrolled, with `key` bumped only when a suggestion is
                    generated. Mirroring every keystroke into state would remount
                    the field on each one and steal focus; the value is read from
                    FormData at submit, so it never needs to live in state.
                  */}
                  <TextField
                    key={suggestionId}
                    name="temporaryPassword"
                    label="Temporary password"
                    required
                    hint="At least 12 characters. Hand this over securely."
                    defaultValue={password}
                    errors={errors.temporaryPassword}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-1"
                  onClick={suggestPassword}
                >
                  <RefreshCw />
                  Suggest
                </Button>
              </div>
            </div>

            <SelectField
              name="roleId"
              label="Role"
              required
              hint="You cannot assign a role at or above your own level."
              options={roles.map((r) => ({ value: r.id, label: r.label }))}
              errors={errors.roleId}
            />

            <div className="space-y-2">
              <Label>Company access</Label>
              <p className="text-muted-foreground text-xs">
                Leave all unticked for an account with no company data — useful for a
                pure administrator.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {companies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={companyIds.includes(c.id)}
                      onCheckedChange={(checked) => {
                        setCompanyIds((prev) =>
                          checked === true
                            ? [...prev, c.id]
                            : prev.filter((id) => id !== c.id),
                        );
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <SelectField
              name="employeeId"
              label="Link to employee"
              hint="Optional. Only employees without an account are listed."
              defaultValue="none"
              options={[
                { value: "none", label: "— Not linked —" },
                ...employees.map((e) => ({ value: e.id, label: e.label })),
              ]}
              errors={errors.employeeId}
            />

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
                {pending ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
