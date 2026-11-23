"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Wallet } from "lucide-react";
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
import { TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { formatAmount, SALARY_PART_LABELS, SALARY_PARTS, total } from "@/lib/increments";
import { updateEmployeeSalaryAction } from "@/server/actions/increments";

export type Salary = {
  basic: string | null;
  transport: string | null;
  housing: string | null;
  other: string | null;
};

/** Monthly salary breakdown; increment lists copy "current salary" from here. */
export function SalaryCard({
  employeeId,
  salary,
  canManage,
}: {
  employeeId: string;
  salary: Salary;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const recorded = SALARY_PARTS.some((p) => salary[p] !== null);
  const filled = {
    basic: salary.basic ?? "0",
    transport: salary.transport ?? "0",
    housing: salary.housing ?? "0",
    other: salary.other ?? "0",
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateEmployeeSalaryAction({
        employeeId,
        basic: readString(fd, "basic"),
        transport: readString(fd, "transport"),
        housing: readString(fd, "housing"),
        other: readString(fd, "other"),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Salary saved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wallet className="size-4" />
          Salary
        </CardTitle>
        {canManage ? (
          <Button
            size="sm"
            variant="outline"
            aria-label={recorded ? "Edit salary" : "Add salary"}
            onClick={() => {
              setOpen(true);
            }}
          >
            <Pencil />
            {recorded ? "Edit" : "Add"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {recorded ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
            {SALARY_PARTS.map((p) => (
              <div key={p}>
                <dt className="text-muted-foreground text-xs">{SALARY_PART_LABELS[p]}</dt>
                <dd className="tabular-nums">{formatAmount(filled[p])}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted-foreground text-xs">Total (SAR)</dt>
              <dd className="font-semibold tabular-nums">{formatAmount(total(filled))}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">No salary recorded.</p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Salary</DialogTitle>
              <DialogDescription>
                Monthly amounts in SAR. Leave a box blank if it does not apply.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              {SALARY_PARTS.map((p) => (
                <TextField
                  key={p}
                  name={p}
                  label={SALARY_PART_LABELS[p]}
                  defaultValue={salary[p] === null ? "" : String(Number(salary[p]))}
                  errors={errors[p]}
                />
              ))}
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
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
