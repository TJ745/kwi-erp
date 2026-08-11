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
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { TICKET_PRIORITIES } from "@/lib/schemas/it";
import { createTicketAction } from "@/server/actions/it";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function TicketCreateButton({
  companies,
  departments,
  categories,
}: {
  companies: { id: string; code: string; name: string }[];
  departments: { id: string; name: string; companyId: string }[];
  categories: { id: string; name: string; defaultSlaHours: number | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState(companies[0]?.id ?? "");

  const departmentChoices = departments.filter((d) => d.companyId === companyId);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createTicketAction({
        companyId,
        categoryId: readString(fd, "categoryId"),
        subject: readString(fd, "subject"),
        description: readString(fd, "description"),
        priority: readString(fd, "priority") || "MEDIUM",
        departmentId: readString(fd, "departmentId"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(`Ticket ${result.data.ticketNo} raised.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); }}>
        <Plus />
        Raise ticket
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raise a ticket</DialogTitle>
            <DialogDescription>
              A ticket number is generated automatically. Categories with an SLA set a due date.
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
              name="subject"
              label="Subject"
              required
              placeholder="Printer on the 2nd floor will not print"
              errors={errors.subject}
            />

            <TextAreaField
              name="description"
              label="Description"
              required
              rows={4}
              errors={errors.description}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="ticket-company" className="text-sm font-medium">
                  Company <span className="text-destructive">*</span>
                </label>
                <select
                  id="ticket-company"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                  }}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <SelectField
                name="departmentId"
                label="Department"
                defaultValue="none"
                options={[
                  { value: "none", label: "— None —" },
                  ...departmentChoices.map((d) => ({ value: d.id, label: d.name })),
                ]}
                errors={errors.departmentId}
              />

              <SelectField
                name="categoryId"
                label="Category"
                required
                options={categories.map((c) => ({
                  value: c.id,
                  label: c.defaultSlaHours
                    ? `${c.name} (${String(c.defaultSlaHours)}h SLA)`
                    : c.name,
                }))}
                errors={errors.categoryId}
              />

              <SelectField
                name="priority"
                label="Priority"
                defaultValue="MEDIUM"
                options={TICKET_PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }))}
                errors={errors.priority}
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
                {pending ? "Raising…" : "Raise ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
