"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createPositionAction, updatePositionAction } from "@/server/actions/org";

type Company = { id: string; code: string; name: string };
type PositionOption = { id: string; title: string; companyCode: string | null };

/**
 * Job titles. Unlike departments, a position may be shared across every company
 * — that is what a null `companyId` means, and the schema maps the sentinel
 * "all" back to undefined for exactly this select.
 */
export function PositionDialog({
  mode,
  companies,
  positions,
  position,
}: {
  mode: "create" | "edit";
  companies: Company[];
  /** Every other role, for the "reports to" line. */
  positions: PositionOption[];
  position?: {
    id: string;
    title: string;
    titleAr: string | null;
    grade: string | null;
    companyId: string | null;
    budgetedHeadcount: number;
    reportsToPositionId: string | null;
    status: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    const payload = {
      companyId: readString(fd, "companyId"),
      title: readString(fd, "title"),
      titleAr: readString(fd, "titleAr"),
      grade: readString(fd, "grade"),
      budgetedHeadcount: readString(fd, "budgetedHeadcount") || "0",
      reportsToPositionId: readString(fd, "reportsToPositionId"),
      status: readString(fd, "status") || "ACTIVE",
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPositionAction(payload)
          : await updatePositionAction({ ...payload, id: position?.id ?? "" });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Position created." : "Position updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size={mode === "create" ? "sm" : "icon-sm"}
        variant={mode === "create" ? "outline" : "ghost"}
        aria-label={mode === "edit" ? `Edit ${position?.title ?? ""}` : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        {mode === "create" ? (
          <>
            <Plus />
            Add position
          </>
        ) : (
          <Pencil />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add position" : "Edit position"}</DialogTitle>
            <DialogDescription>
              A position with no company is available to every company. Titles must be
              unique within that scope.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <SelectField
              name="companyId"
              label="Company"
              defaultValue={position?.companyId ?? "all"}
              options={[
                { value: "all", label: "— Shared across all companies —" },
                ...companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
              ]}
              errors={errors.companyId}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="title"
                label="Title"
                required
                defaultValue={position?.title ?? ""}
                errors={errors.title}
              />
              <TextField
                name="titleAr"
                label="Title (Arabic)"
                hint="Used on official letters."
                defaultValue={position?.titleAr ?? ""}
                errors={errors.titleAr}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="budgetedHeadcount"
                label="Budgeted seats"
                type="number"
                hint="How many people this role should have. 0 keeps it off the org chart; anything above the number of holders shows as a vacancy."
                defaultValue={String(position?.budgetedHeadcount ?? 0)}
                errors={errors.budgetedHeadcount}
              />
              <SelectField
                name="reportsToPositionId"
                label="Reports to"
                hint="Where an unfilled seat is drawn. Only needed when nobody holds this role."
                defaultValue={position?.reportsToPositionId ?? "none"}
                options={[
                  { value: "none", label: "— Not set —" },
                  ...positions
                    // A role reporting to itself is refused by the server; not
                    // offering it avoids the pointless round trip.
                    .filter((p) => p.id !== position?.id)
                    .map((p) => ({
                      value: p.id,
                      label: p.companyCode ? `${p.title} (${p.companyCode})` : p.title,
                    })),
                ]}
                errors={errors.reportsToPositionId}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="grade"
                label="Grade"
                defaultValue={position?.grade ?? ""}
                errors={errors.grade}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={position?.status ?? "ACTIVE"}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
                errors={errors.status}
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
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
