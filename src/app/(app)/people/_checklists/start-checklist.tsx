"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { DateField, SelectField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { startChecklistAction } from "@/server/actions/hr";

export function StartChecklistButton({
  type,
  templates,
  employees,
}: {
  type: string;
  templates: { id: string; name: string; stepCount: number }[];
  employees: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await startChecklistAction({
        employeeId: readString(fd, "employeeId"),
        templateId: readString(fd, "templateId"),
        targetDate: readString(fd, "targetDate"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success("Checklist started.");
      setOpen(false);
      router.push(`/people/checklists/${result.data.id}`);
      router.refresh();
    });
  }

  const label = type.charAt(0) + type.slice(1).toLowerCase();

  return (
    <>
      <Button
        size="sm"
        disabled={templates.length === 0}
        title={templates.length === 0 ? "No active templates for this type." : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus />
        Start {label.toLowerCase()}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Steps are copied from the template, so editing the template later will not change
              this checklist.
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

            <SelectField
              name="employeeId"
              label="Employee"
              required
              options={employees.map((e) => ({ value: e.id, label: e.label }))}
              errors={errors.employeeId}
            />

            <SelectField
              name="templateId"
              label="Template"
              required
              defaultValue={templates[0]?.id ?? ""}
              options={templates.map((t) => ({
                value: t.id,
                label: `${t.name} (${String(t.stepCount)} steps)`,
              }))}
              errors={errors.templateId}
            />

            <DateField
              name="targetDate"
              label="Target completion date"
              errors={errors.targetDate}
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
                {pending ? "Starting…" : "Start"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
