"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ENTITY_TYPES } from "@/lib/schemas/platform";
import {
  createDocumentTypeAction,
  deleteDocumentTypeAction,
  updateDocumentTypeAction,
} from "@/server/actions/platform";

export type DocumentTypeValues = {
  id: string;
  key: string;
  name: string;
  appliesTo: string[];
  requiresExpiry: boolean;
  defaultWarningDays: string;
  isSystem: boolean;
  inUse: number;
};

export function DocumentTypeControls({
  mode,
  values,
}: {
  mode: "create" | "row";
  values?: DocumentTypeValues;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const [appliesTo, setAppliesTo] = React.useState<string[]>(values?.appliesTo ?? ["EMPLOYEE"]);
  const [requiresExpiry, setRequiresExpiry] = React.useState(values?.requiresExpiry ?? false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const payload = {
      key: readString(fd, "key"),
      name: readString(fd, "name"),
      appliesTo,
      requiresExpiry,
      defaultWarningDays: readString(fd, "defaultWarningDays"),
    };

    startTransition(async () => {
      const result = values
        ? await updateDocumentTypeAction({ ...payload, id: values.id })
        : await createDocumentTypeAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(values ? "Type updated." : "Type added.");
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!values) return;
    startTransition(async () => {
      const result = await deleteDocumentTypeAction({ id: values.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Type deleted.");
      router.refresh();
    });
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{values ? "Edit document type" : "Add document type"}</DialogTitle>
            <DialogDescription>
              {values?.isSystem
                ? "This is a system type. Its key is fixed because seeded logic refers to it; everything else can change."
                : "The key is how other parts of the system refer to this type."}
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

            <TextField
              name="name"
              label="Name"
              required
              defaultValue={values?.name ?? ""}
              errors={errors.name}
            />
            <TextField
              name="key"
              label="Key"
              required
              hint={
                values?.isSystem
                  ? "Fixed for system types — changes here are ignored."
                  : "Uppercase letters, digits, underscores."
              }
              defaultValue={values?.key ?? ""}
              errors={errors.key}
            />

            <div className="space-y-2">
              <Label>Applies to</Label>
              <div className="grid grid-cols-2 gap-2">
                {ENTITY_TYPES.map((entity) => (
                  <div key={entity} className="flex items-center gap-2">
                    <Checkbox
                      id={`applies-${entity}`}
                      checked={appliesTo.includes(entity)}
                      onCheckedChange={(checked) => {
                        setAppliesTo((current) =>
                          checked === true
                            ? [...current, entity]
                            : current.filter((e) => e !== entity),
                        );
                      }}
                    />
                    <Label htmlFor={`applies-${entity}`} className="font-normal">
                      {entity.replace(/_/g, " ").toLowerCase()}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.appliesTo?.[0] ? (
                <p className="text-destructive text-xs">{errors.appliesTo[0]}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresExpiry"
                checked={requiresExpiry}
                onCheckedChange={(checked) => {
                  setRequiresExpiry(checked === true);
                }}
              />
              <Label htmlFor="requiresExpiry" className="font-normal">
                Expiry date is required for this type
              </Label>
            </div>

            <TextField
              name="defaultWarningDays"
              label="Warning thresholds (days)"
              hint="Comma separated. Sorted and de-duplicated on save."
              defaultValue={values?.defaultWarningDays ?? "90, 60, 30, 15, 7, 1"}
              errors={errors.defaultWarningDays}
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
              {pending ? "Saving…" : values ? "Save changes" : "Add type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (mode === "create") {
    return (
      <>
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          Add type
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Document type actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            // System types and types in use are refused server-side; the menu
            // reflects that rather than offering a button that always fails.
            disabled={values?.isSystem === true || (values?.inUse ?? 0) > 0 || pending}
            onSelect={() => {
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}
