"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { lockVaultAction, unlockVaultAction } from "@/server/actions/vault";

/**
 * The unlock gate — docs/SECURITY.md §5.4.
 *
 * Re-entering the password is a deliberate second factor of intent: it means a
 * walk-up attacker on an already-signed-in machine still cannot read secrets.
 */
export function VaultLock({ unlocked, canReveal }: { unlocked: boolean; canReveal: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  if (!canReveal) return null;

  function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await unlockVaultAction({ password: readString(fd, "password") });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success("Vault unlocked.");
      setOpen(false);
      router.refresh();
    });
  }

  function lock() {
    startTransition(async () => {
      const result = await lockVaultAction({});
      if (result.success) {
        toast.success("Vault locked.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      {unlocked ? (
        <div className="flex items-center gap-2">
          <Badge variant="valid" className="gap-1">
            <LockOpen className="size-3" />
            Unlocked
          </Badge>
          <Button variant="outline" size="sm" disabled={pending} onClick={lock}>
            <Lock />
            Lock
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setOpen(true);
          }}
        >
          <Lock />
          Unlock vault
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={unlock} noValidate>
            <DialogHeader>
              <DialogTitle>Unlock the vault</DialogTitle>
              <DialogDescription>
                Confirm your password to reveal credentials. The vault locks itself again after a
                period of inactivity, and every reveal is recorded.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive mb-4 rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}
              <TextField
                name="password"
                label="Your password"
                type="password"
                required
                errors={errors.password}
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
                {pending ? "Unlocking…" : "Unlock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
