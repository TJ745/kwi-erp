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
import { TextField } from "@/components/forms/field";
import { ChoiceGroup } from "@/components/forms/choice-group";
import { readString } from "@/lib/form-data";
import { createTimesheetAction } from "@/server/actions/timesheets";

/** This month as `YYYY-MM`: the sheet for November runs 16 Oct – 15 Nov. */
function thisMonth(): string {
  const now = new Date();
  // After the 15th the current period has ended; the next one is being kept.
  const d = now.getDate() > 15 ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A new monthly sheet: pick the month, the companies on it and the group.
 * The rows come from the employee records — everyone employed in the period.
 */
export function NewTimesheetDialog({
  companies,
}: {
  companies: { id: string; code: string; name: string }[];
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
      const result = await createTimesheetAction({
        month: readString(fd, "month"),
        companyIds: fd.getAll("companyIds").map(String),
        group: readString(fd, "group") || "NON_SAUDI",
        title: readString(fd, "title"),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success("Timesheet created.");
      setOpen(false);
      router.push(`/people/timesheet/${result.data.id}`);
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus />
        New timesheet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New timesheet</DialogTitle>
            <DialogDescription>
              A month runs from the 16th of the month before to the 15th. Everyone employed in those
              days is added; leave already recorded is marked V, S or L.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}
            <TextField
              name="month"
              label="Month"
              type="month"
              required
              defaultValue={thisMonth()}
              hint="e.g. November 2026 = 16 Oct – 15 Nov."
              errors={errors.month}
            />
            <ChoiceGroup
              name="companyIds"
              label="Companies on this sheet"
              multiple
              options={companies.map((c) => ({ value: c.id, label: c.code }))}
            />
            {errors.companyIds ? (
              <p className="text-destructive -mt-2 text-xs">{errors.companyIds[0]}</p>
            ) : null}
            <ChoiceGroup
              name="group"
              label="Employees"
              allowBlank={false}
              defaultValue="NON_SAUDI"
              options={[
                { value: "NON_SAUDI", label: "Non-Saudi (overtime)" },
                { value: "SAUDI", label: "Saudi (delay time)" },
                { value: "ALL", label: "Everyone" },
              ]}
            />
            <TextField
              name="title"
              label="Title"
              hint="Blank uses the company codes, e.g. KWI & KMI, or S_KWI for Saudis."
              errors={errors.title}
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
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
