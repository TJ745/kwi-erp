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
import { DateField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { endEnrolmentAction, enrolEmployeesAction } from "@/server/actions/insurance";

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
  policy: { id: string; policyNumber: string; className: string | null; closed: boolean };
  enrolments: EnrolmentRow[];
  /** Employees of the policy's company — the server refuses any other. */
  employees: { id: string; fullName: string; employeeNo: string; status: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [ending, setEnding] = React.useState<EnrolmentRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const active = enrolments.filter((e) => e.endDate === null || e.endDate >= today);
  const enrolledIds = new Set(enrolments.map((e) => e.employee.id));
  // Only people still working here can be added.
  const available = employees.filter(
    (e) => !enrolledIds.has(e.id) && (e.status === "ACTIVE" || e.status === "ON_LEAVE"),
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const q = search.trim().toLowerCase();
  const shown = q
    ? available.filter(
        (e) => e.fullName.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q),
      )
    : available;
  const allShownSelected = shown.length > 0 && shown.every((e) => selected.has(e.id));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await enrolEmployeesAction({
        policyId: policy.id,
        employeeIds: [...selected],
        memberNumber: selected.size === 1 ? readString(fd, "memberNumber") : "",
        className: readString(fd, "className"),
        startDate: readString(fd, "startDate"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      const { added } = result.data;
      toast.success(added === 1 ? "1 employee enrolled." : `${String(added)} employees enrolled.`);
      setSelected(new Set());
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

                  {e.endDate && e.endDate < today ? (
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

          {canManage && policy.closed ? (
            <p className="text-muted-foreground border-t pt-4 text-sm">
              This policy has ended, so nobody can be added to it.
            </p>
          ) : canManage ? (
            <form onSubmit={onSubmit} noValidate className="space-y-4 border-t pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <UserPlus className="size-4" />
                Add members
              </h3>

              {available.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Every working employee of this company is already on the policy.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <input
                      type="search"
                      aria-label="Search employees"
                      placeholder="Search name or ID…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                      }}
                      className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={allShownSelected}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const emp of shown) {
                              if (on) next.add(emp.id);
                              else next.delete(emp.id);
                            }
                            return next;
                          });
                        }}
                      />
                      Select all{q ? " shown" : ""} ({shown.length})
                    </label>
                    <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                      {shown.map((e) => (
                        <li key={e.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.has(e.id)}
                              onChange={(ev) => {
                                toggle(e.id, ev.target.checked);
                              }}
                            />
                            {e.fullName}
                            <span className="text-muted-foreground text-xs">{e.employeeNo}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground text-xs">
                      {selected.size} selected
                      {errors.employeeIds ? (
                        <span className="text-destructive ml-2">{errors.employeeIds[0]}</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <DateField
                      name="startDate"
                      label="Covered from"
                      required
                      defaultValue={today}
                      errors={errors.startDate}
                    />
                    <TextField
                      name="className"
                      label="Class"
                      hint={
                        policy.className
                          ? `Blank uses the policy class (${policy.className}).`
                          : "Leave blank to use the policy class."
                      }
                      errors={errors.className}
                    />
                    {selected.size === 1 ? (
                      <TextField
                        name="memberNumber"
                        label="Member number"
                        hint="From the insurer's card."
                        errors={errors.memberNumber}
                      />
                    ) : null}
                  </div>

                  <Button type="submit" size="sm" disabled={pending || selected.size === 0}>
                    {pending
                      ? "Saving…"
                      : selected.size > 1
                        ? `Enrol ${String(selected.size)} employees`
                        : "Enrol"}
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
              The enrolment is kept with an end date rather than deleted — who was covered when a
              claim was made is asked long afterwards.
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
