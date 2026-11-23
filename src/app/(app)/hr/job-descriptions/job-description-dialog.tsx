"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { JD_LISTS, type JdListKey } from "@/lib/job-description";
import { createJobDescriptionAction, updateJobDescriptionAction } from "@/server/actions/hiring";

export type JobDescriptionValues = {
  id: string;
  companyId: string | null;
  positionId: string | null;
  title: string;
  department: string | null;
  reportsTo: string | null;
  oversees: string | null;
  isActive: boolean;
  offerCount: number;
} & Record<JdListKey, string | null>;

const PLACEHOLDERS: Record<JdListKey, string> = {
  organizational: "Al-Kuhaimi Wood Industries.",
  departmental:
    "Know how to read shop drawings.\nKnow how to make cutting list and work on provided cutting list.",
  education: "Should have degree or technical draftsman diploma",
  experience: "Minimum experience of 2 years in wooden work.",
  skills: "Should have knowledge in wood joinery, wooden works, doors, cabinets, cladding etc.",
  others:
    "Willing to work at allocated region upon joining.\nShould have good ethics to work as team.",
};

export function JobDescriptionDialog({
  companies,
  positions,
  description,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  description?: JobDescriptionValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(description?.isActive ?? true);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      positionId: readString(fd, "positionId"),
      title: readString(fd, "title"),
      department: readString(fd, "department"),
      reportsTo: readString(fd, "reportsTo"),
      oversees: readString(fd, "oversees"),
      organizational: readString(fd, "organizational"),
      departmental: readString(fd, "departmental"),
      education: readString(fd, "education"),
      experience: readString(fd, "experience"),
      skills: readString(fd, "skills"),
      others: readString(fd, "others"),
      isActive,
    };

    startTransition(async () => {
      const result = description
        ? await updateJobDescriptionAction({ ...values, id: description.id })
        : await createJobDescriptionAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(description ? "Description updated." : "Description created.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {!isControlled ? (
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          New description
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {description ? "Edit job description" : "New job description"}
              </DialogTitle>
              <DialogDescription>
                Fill it in like the company template; it prints the same way. Lists take one item
                per line — each line becomes a bullet.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="title"
                  label="Job Title"
                  required
                  placeholder="Carpenter"
                  defaultValue={description?.title ?? ""}
                  errors={errors.title}
                />
                <TextField
                  name="department"
                  label="Department"
                  placeholder="KWI – Riyadh"
                  defaultValue={description?.department ?? ""}
                  errors={errors.department}
                />
                <TextField
                  name="reportsTo"
                  label="Reports to"
                  placeholder="Technical Manager"
                  defaultValue={description?.reportsTo ?? ""}
                  errors={errors.reportsTo}
                />
                <TextField
                  name="oversees"
                  label="Oversees"
                  hint="Blank prints “(Optional)”, as on the template."
                  defaultValue={description?.oversees ?? ""}
                  errors={errors.oversees}
                />
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Duties &amp; Responsibilities</legend>
                {JD_LISTS.filter((l) => l.group === "duties").map((l) => (
                  <TextAreaField
                    key={l.key}
                    name={l.key}
                    label={l.label}
                    rows={l.key === "departmental" ? 7 : 2}
                    placeholder={PLACEHOLDERS[l.key]}
                    defaultValue={description?.[l.key] ?? ""}
                    errors={errors[l.key]}
                  />
                ))}
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Desired Job Profile</legend>
                {JD_LISTS.filter((l) => l.group === "profile").map((l) => (
                  <TextAreaField
                    key={l.key}
                    name={l.key}
                    label={l.label}
                    rows={3}
                    placeholder={PLACEHOLDERS[l.key]}
                    defaultValue={description?.[l.key] ?? ""}
                    errors={errors[l.key]}
                  />
                ))}
              </fieldset>

              <details className="rounded-md border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  More (company, position, status)
                </summary>
                <div className="mt-3 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      name="companyId"
                      label="Company"
                      placeholder="All companies"
                      options={companies.map((c) => ({
                        value: c.id,
                        label: `${c.code} — ${c.name}`,
                      }))}
                      defaultValue={description?.companyId ?? ""}
                      errors={errors.companyId}
                    />
                    <SelectField
                      name="positionId"
                      label="Position"
                      placeholder="Not linked"
                      options={positions.map((p) => ({ value: p.id, label: p.title }))}
                      defaultValue={description?.positionId ?? ""}
                      errors={errors.positionId}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isActive"
                      checked={isActive}
                      onCheckedChange={(checked) => {
                        setIsActive(checked === true);
                      }}
                    />
                    <Label htmlFor="isActive" className="font-normal">
                      Active — available to attach to new offers
                    </Label>
                  </div>
                </div>
              </details>
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
                {pending ? "Saving…" : description ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
