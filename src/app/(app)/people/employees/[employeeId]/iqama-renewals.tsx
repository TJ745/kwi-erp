"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { DateField, SelectField, TextAreaField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { RENEWAL_STATUSES } from "@/lib/schemas/employee";
import { startIqamaRenewalAction, updateIqamaRenewalAction } from "@/server/actions/employees";

export type RenewalRow = {
  id: string;
  previousExpiry: string;
  newExpiry: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  status: string;
  notes: string | null;
};

const titleCase = (v: string) =>
  v
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

/**
 * Iqama renewal tracking.
 *
 * Completing a renewal is the only path that moves the Iqama expiry date, and
 * it updates the ExpiryIndex in the same transaction — so the dashboard and the
 * 7/15/30/60/90-day buckets follow immediately rather than at the next
 * reconciliation.
 */
export function IqamaRenewals({
  employeeId,
  canEdit,
  hasIqama,
  renewals,
}: {
  employeeId: string;
  canEdit: boolean;
  hasIqama: boolean;
  renewals: RenewalRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [editing, setEditing] = React.useState<RenewalRow | null>(null);
  const [status, setStatus] = React.useState("IN_PROGRESS");

  const open = renewals.find((r) => r.status !== "COMPLETED" && r.status !== "REJECTED");

  function start() {
    startTransition(async () => {
      const result = await startIqamaRenewalAction({ employeeId, notes: "" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Renewal opened.");
      router.refresh();
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateIqamaRenewalAction({
        id: editing.id,
        employeeId,
        status,
        submittedAt: readString(fd, "submittedAt"),
        newExpiry: readString(fd, "newExpiry"),
        notes: readString(fd, "notes"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(
        status === "COMPLETED" ? "Renewal completed; expiry updated." : "Renewal updated.",
      );
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">Renewals</CardTitle>
        {canEdit && hasIqama && !open ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={start}>
            <RefreshCw />
            Start renewal
          </Button>
        ) : null}
      </CardHeader>

      <CardContent>
        {!hasIqama ? (
          <p className="text-muted-foreground text-sm">
            Record the Iqama first — a renewal replaces a known expiry date.
          </p>
        ) : renewals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No renewals recorded. Starting one captures the current expiry as the date being
            replaced.
          </p>
        ) : (
          <ul className="space-y-2">
            {renewals.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm">
                    <StatusBadge status={r.status} />
                    <span className="text-muted-foreground">
                      {r.previousExpiry}
                      {r.newExpiry ? ` → ${r.newExpiry}` : " → pending"}
                    </span>
                  </p>
                  {r.notes ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">{r.notes}</p>
                  ) : null}
                </div>

                {canEdit && r.status !== "COMPLETED" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(r);
                      setStatus(r.status);
                      setErrors({});
                    }}
                  >
                    Update
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update renewal</DialogTitle>
            <DialogDescription>
              Completing a renewal moves the Iqama expiry date and updates the expiry register at
              the same time.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <SelectField
              name="status"
              label="Status"
              required
              defaultValue={editing?.status ?? "IN_PROGRESS"}
              onChange={setStatus}
              options={RENEWAL_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
              errors={errors.status}
            />

            <DateField
              name="submittedAt"
              label="Submitted on"
              defaultValue={editing?.submittedAt ?? ""}
              errors={errors.submittedAt}
            />

            <DateField
              name="newExpiry"
              label="New expiry date"
              required={status === "COMPLETED"}
              hint={
                status === "COMPLETED"
                  ? `Required, and must be later than ${editing?.previousExpiry ?? "the current expiry"}.`
                  : "Fill in once the renewed Iqama is issued."
              }
              defaultValue={editing?.newExpiry ?? ""}
              errors={errors.newExpiry}
            />

            <TextAreaField
              name="notes"
              label="Notes"
              defaultValue={editing?.notes ?? ""}
              errors={errors.notes}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
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
