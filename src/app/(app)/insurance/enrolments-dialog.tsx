"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField, SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { endEnrolmentAction, enrolEmployeeAction } from "@/server/actions/insurance";

export type EnrolmentRow = {
  id: string;
  memberNumber: string | null;
  className: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  employee: { id: string; fullName: string; employeeNo: string };
};

/**
 * Who is covered by a policy.
 *
 * Ending cover sets an end date rather than deleting the row: "who was covered
 * when this claim was made" is asked long after somebody leaves, and a deleted
 * enrolment cannot answer it.
 */
export function EnrolmentsDialog({
  policy,
  enrolments,
  employees,
  canManage,
}: {
  policy: { id: string; policyNumber: string; className: string | null };
  enrolments: EnrolmentRow[];
  /** Employees of the policy's company — the server refuses any other. */
  employees: { id: string; fullName: string; employeeNo: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [ending, setEnding] = React.useState<EnrolmentRow | null>(null);

  const active = enrolments.filter((e) => e.endDate === null);
  const enrolledIds = new Set(enrolments.map((e) => e.employee.id));
  const available = employees.filter((e) => !enrolledIds.has(e.id));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await enrolEmployeeAction({
        policyId: policy.id,
        employeeId: readString(fd, "employeeId"),
        memberNumber: readString(fd, "memberNumber"),
        className: readString(fd, "className"),
        startDate: readString(fd, "startDate"),
        endDate: readString(fd, "endDate"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success("Employee enrolled.");
      router.refresh();
    });
  }

  function endCover(row: EnrolmentRow, endDate: string) {
    startTransition(async () => {
      const result = await endEnrolmentAction({
        id: row.id,
        policyId: policy.id,
        endDate,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Cover ended for ${row.employee.fullName}.`);
      setEnding(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Members of policy ${policy.policyNumber}`}
        title={`${String(active.length)} covered`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Users />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Members of {policy.policyNumber}</DialogTitle>
            <DialogDescription>
              {active.length === 0
                ? "Nobody is covered by this policy yet."
                : `${String(active.length)} employee${active.length === 1 ? "" : "s"} currently covered.`}
            </DialogDescription>
          </DialogHeader>

          {enrolments.length > 0 ? (
            <ul className="space-y-2">
              {enrolments.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {e.employee.fullName}{" "}
                      <span className="text-muted-foreground font-normal">
                        {e.employee.employeeNo}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {e.className ? `Class ${e.className} · ` : ""}
                      from {e.startDate}
                      {e.endDate ? ` · ended ${e.endDate}` : ""}
                      {e.memberNumber ? ` · member ${e.memberNumber}` : ""}
                    </p>
                  </div>

                  {e.endDate ? (
                    <Badge variant="outline">Ended</Badge>
                  ) : canManage ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`End cover for ${e.employee.fullName}`}
                      onClick={() => {
                        setEnding(e);
                      }}
                    >
                      <UserMinus />
                    </Button>
                  ) : (
                    <Badge>Covered</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {canManage ? (
            <form onSubmit={onSubmit} noValidate className="space-y-4 border-t pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <UserPlus className="size-4" />
                Add a member
              </h3>

              {available.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Every employee of this company is already on the policy.
                </p>
              ) : (
                <>
                  <SelectField
                    name="employeeId"
                    label="Employee"
                    required
                    options={available.map((e) => ({
                      value: e.id,
                      label: `${e.fullName} (${e.employeeNo})`,
                    }))}
                    errors={errors.employeeId}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      name="memberNumber"
                      label="Member number"
                      hint="From the insurer's card."
                      errors={errors.memberNumber}
                    />
                    <TextField
                      name="className"
                      label="Class"
                      hint={
                        policy.className
                          ? `Defaults to the policy class (${policy.className}).`
                          : "Leave blank to use the policy class."
                      }
                      errors={errors.className}
                    />
                    <DateField
                      name="startDate"
                      label="Covered from"
                      required
                      errors={errors.startDate}
                    />
                    <DateField
                      name="endDate"
                      label="Covered until"
                      hint="Only if cover is known to end early."
                      errors={errors.endDate}
                    />
                  </div>

                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? "Saving…" : "Enrol"}
                  </Button>
                </>
              )}
            </form>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ending !== null}
        onOpenChange={(next) => {
          if (!next) setEnding(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End cover for {ending?.employee.fullName}?</DialogTitle>
            <DialogDescription>
              The enrolment is kept with an end date rather than deleted — who was covered
              when a claim was made is asked long afterwards.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              if (ending) endCover(ending, readString(fd, "endDate"));
            }}
            noValidate
            className="space-y-4"
          >
            <DateField
              name="endDate"
              label="Cover ends on"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEnding(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Saving…" : "End cover"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
