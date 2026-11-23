"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import {
  createEmergencyContactAction,
  deleteEmergencyContactAction,
  updateEmergencyContactAction,
} from "@/server/actions/employees";

export type ContactRow = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  altPhone: string | null;
  address: string | null;
};

/**
 * Next of kin.
 *
 * The relation was already included in the profile query and then never
 * rendered — the data was fetched and thrown away, and there was no way to
 * enter one in the first place.
 */
export function EmergencyContacts({
  employeeId,
  canEdit,
  contacts,
}: {
  employeeId: string;
  canEdit: boolean;
  contacts: ContactRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContactRow | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ContactRow | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    const payload = {
      employeeId,
      name: readString(fd, "name"),
      relation: readString(fd, "relation"),
      phone: readString(fd, "phone"),
      altPhone: readString(fd, "altPhone"),
      address: readString(fd, "address"),
    };

    startTransition(async () => {
      const result = editing
        ? await updateEmergencyContactAction({ ...payload, id: editing.id })
        : await createEmergencyContactAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(editing ? "Contact updated." : "Contact added.");
      setOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function remove(contact: ContactRow) {
    startTransition(async () => {
      const result = await deleteEmergencyContactAction({ id: contact.id, employeeId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${contact.name}.`);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">Emergency contacts</CardTitle>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setErrors({});
              setOpen(true);
            }}
          >
            <Plus />
            Add
          </Button>
        ) : null}
      </CardHeader>

      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No emergency contact recorded. This is who the company calls first in an incident.
          </p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.name}{" "}
                    <span className="text-muted-foreground font-normal">({c.relation})</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {c.phone}
                    {c.altPhone ? ` · ${c.altPhone}` : ""}
                  </p>
                  {c.address ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">{c.address}</p>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="flex shrink-0 items-center">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => {
                        setEditing(c);
                        setErrors({});
                        setOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${c.name}`}
                      onClick={() => {
                        setConfirmDelete(c);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit contact" : "Add emergency contact"}</DialogTitle>
            <DialogDescription>Who to call about this employee in an emergency.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="name"
                label="Name"
                required
                defaultValue={editing?.name ?? ""}
                errors={errors.name}
              />
              <TextField
                name="relation"
                label="Relationship"
                required
                placeholder="Brother"
                defaultValue={editing?.relation ?? ""}
                errors={errors.relation}
              />
              <TextField
                name="phone"
                label="Phone"
                required
                defaultValue={editing?.phone ?? ""}
                errors={errors.phone}
              />
              <TextField
                name="altPhone"
                label="Alternate phone"
                defaultValue={editing?.altPhone ?? ""}
                errors={errors.altPhone}
              />
            </div>

            <TextAreaField
              name="address"
              label="Address"
              defaultValue={editing?.address ?? ""}
              errors={errors.address}
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
                {pending ? "Saving…" : editing ? "Save" : "Add contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “{confirmDelete?.name}”?</DialogTitle>
            <DialogDescription>
              The contact is deleted outright. Emergency contacts are not history — a stale one is
              worse than none.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (confirmDelete) remove(confirmDelete);
              }}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
