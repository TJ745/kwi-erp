"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { createRoleAction, deleteRoleAction } from "@/server/actions/users";

/**
 * Creating a custom role.
 *
 * A new role starts with NO permissions — granting them is the separate,
 * separately audited step in the role editor. A role that arrived
 * pre-populated would make "who granted this" unanswerable afterwards.
 */
export function RoleDialog({ suggestedRank }: { suggestedRank: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createRoleAction({
        key: readString(fd, "key").toUpperCase(),
        name: readString(fd, "name"),
        description: readString(fd, "description"),
        rank: readString(fd, "rank"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Role created. Give it permissions from the role editor.");
      setOpen(false);
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
        Add role
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add role</DialogTitle>
            <DialogDescription>
              The role is created with no permissions. Open it afterwards to choose what
              it can do.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="key"
                label="Key"
                required
                hint="Uppercase, e.g. SITE_SUPERVISOR. Cannot be changed later."
                errors={errors.key}
              />
              <TextField
                name="name"
                label="Display name"
                required
                errors={errors.name}
              />
            </div>

            <TextField
              name="description"
              label="Description"
              hint="What this role is for."
              errors={errors.description}
            />

            <TextField
              name="rank"
              label="Rank"
              type="number"
              required
              hint="Lower is more senior. You cannot create a role at or above your own level."
              defaultValue={String(suggestedRank)}
              errors={errors.rank}
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
                {pending ? "Creating…" : "Create role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Deleting a custom role.
 *
 * Only offered for non-system roles with nobody assigned. The server refuses
 * both cases anyway; not offering the button avoids a click that can only fail.
 */
export function DeleteRoleButton({
  roleId,
  roleName,
  userCount,
}: {
  roleId: string;
  roleName: string;
  userCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteRoleAction({ roleId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Role ${roleName} deleted.`);
      setOpen(false);
      router.refresh();
    });
  }

  if (userCount > 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {userCount} user{userCount === 1 ? "" : "s"} assigned
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${roleName}`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {roleName}?</DialogTitle>
            <DialogDescription>
              Its permission grants are removed with it. Nobody currently has this role,
              so no account is affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
