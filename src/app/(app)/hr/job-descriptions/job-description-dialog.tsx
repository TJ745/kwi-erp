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
import {
  createJobDescriptionAction,
  updateJobDescriptionAction,
} from "@/server/actions/hiring";

export type JobDescriptionValues = {
  id: string;
  companyId: string | null;
  positionId: string | null;
  title: string;
  summary: string | null;
  responsibilities: string | null;
  requirements: string | null;
  isActive: boolean;
  offerCount: number;
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
      summary: readString(fd, "summary"),
      responsibilities: readString(fd, "responsibilities"),
      requirements: readString(fd, "requirements"),
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {description ? "Edit job description" : "New job description"}
              </DialogTitle>
              <DialogDescription>
                {description && description.offerCount > 0
                  ? `${String(description.offerCount)} offer(s) reference this. Saving bumps the version rather than rewriting what they quoted.`
                  : "Leave the company blank to share it across both entities."}
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
                name="title"
                label="Title"
                required
                defaultValue={description?.title ?? ""}
                errors={errors.title}
              />

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

              <TextAreaField
                name="summary"
                label="Summary"
                rows={3}
                defaultValue={description?.summary ?? ""}
                errors={errors.summary}
              />
              <TextAreaField
                name="responsibilities"
                label="Responsibilities"
                rows={6}
                defaultValue={description?.responsibilities ?? ""}
                errors={errors.responsibilities}
              />
              <TextAreaField
                name="requirements"
                label="Requirements"
                rows={6}
                defaultValue={description?.requirements ?? ""}
                errors={errors.requirements}
              />

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
