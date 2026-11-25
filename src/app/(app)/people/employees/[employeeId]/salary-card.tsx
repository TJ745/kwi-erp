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
import { formatAmount } from "@/lib/increments";
import { PAY_PART_LABELS, PAY_PARTS, payTotal, type Pay } from "@/lib/salary";
import { updateEmployeeSalaryAction } from "@/server/actions/increments";

export type Salary = Pay;

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

  const recorded = PAY_PARTS.some((p) => salary[p] !== null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateEmployeeSalaryAction({
        employeeId,
        ...(Object.fromEntries(PAY_PARTS.map((p) => [p, readString(fd, p)])) as Record<
          (typeof PAY_PARTS)[number],
          string
        >),
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
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {PAY_PARTS.map((p) => (
              <div key={p}>
                <dt className="text-muted-foreground text-xs">{PAY_PART_LABELS[p]}</dt>
                <dd className="tabular-nums">{formatAmount(salary[p] ?? "0")}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted-foreground text-xs">Total (SAR)</dt>
              <dd className="font-semibold tabular-nums">{formatAmount(payTotal(salary))}</dd>
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
              {PAY_PARTS.map((p) => (
                <TextField
                  key={p}
                  name={p}
                  label={PAY_PART_LABELS[p]}
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
