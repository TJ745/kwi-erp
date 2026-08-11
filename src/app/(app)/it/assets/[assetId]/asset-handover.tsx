"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
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
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { ASSET_CONDITIONS } from "@/lib/schemas/it";
import { assignAssetAction, returnAssetAction } from "@/server/actions/it";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

type Current = {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  assignedAt: string;
  conditionOut: string;
  accessories: string | null;
  remarks: string | null;
};

/**
 * Handover in and out.
 *
 * Only one of the two actions is ever offered, because an asset is either
 * issued or it is not — the database enforces the same thing with a partial
 * unique index.
 */
export function AssetHandover({
  assetId,
  assetCode,
  canAssign,
  employees,
  current,
}: {
  assetId: string;
  assetCode: string;
  canAssign: boolean;
  employees: { id: string; fullName: string; employeeNo: string }[];
  current: Current | null;
}) {
  const router = useRouter();
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await assignAssetAction({
        assetId,
        employeeId: readString(fd, "employeeId"),
        conditionOut: readString(fd, "conditionOut") || "GOOD",
        accessories: readString(fd, "accessories"),
        remarks: readString(fd, "remarks"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success(`${assetCode} issued.`);
      setIssueOpen(false);
      router.refresh();
    });
  }

  function receive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await returnAssetAction({
        assetId,
        conditionIn: readString(fd, "conditionIn") || "GOOD",
        missingAccessories: readString(fd, "missingAccessories"),
        remarks: readString(fd, "remarks"),
        nextStatus: readString(fd, "nextStatus") || "AVAILABLE",
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success(`${assetCode} returned.`);
      setReturnOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Current holder</CardTitle>
          {canAssign ? (
            current ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReturnOpen(true);
                }}
              >
                <ArrowDownToLine />
                Record return
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={employees.length === 0}
                onClick={() => {
                  setIssueOpen(true);
                }}
              >
                <ArrowUpFromLine />
                Issue asset
              </Button>
            )
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {current ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Issued to</dt>
              <dd>
                <Link
                  href={`/people/employees/${current.employeeId}`}
                  className="font-medium hover:underline"
                >
                  {current.employeeName}
                </Link>
                <span className="text-muted-foreground ml-1 font-mono text-xs">
                  {current.employeeNo}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Issued on</dt>
              <dd className="tabular-nums">{current.assignedAt}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Condition out</dt>
              <dd>{titleCase(current.conditionOut)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Accessories</dt>
              <dd>{current.accessories ?? "—"}</dd>
            </div>
            {current.remarks ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Remarks</dt>
                <dd>{current.remarks}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            Not currently issued. This asset is in the pool.
          </p>
        )}
      </CardContent>

      {/* Issue */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <form onSubmit={issue} noValidate>
            <DialogHeader>
              <DialogTitle>Issue {assetCode}</DialogTitle>
              <DialogDescription>
                Records the handover: who received it, in what condition, and with which
                accessories.
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

              <SelectField
                name="employeeId"
                label="Issue to"
                required
                options={employees.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} (${e.employeeNo})`,
                }))}
                errors={errors.employeeId}
              />
              <SelectField
                name="conditionOut"
                label="Condition"
                defaultValue="GOOD"
                options={ASSET_CONDITIONS.map((c) => ({ value: c, label: titleCase(c) }))}
                errors={errors.conditionOut}
              />
              <TextField
                name="accessories"
                label="Accessories"
                hint="e.g. charger, bag, mouse"
                errors={errors.accessories}
              />
              <TextAreaField name="remarks" label="Remarks" errors={errors.remarks} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIssueOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Issuing…" : "Issue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <form onSubmit={receive} noValidate>
            <DialogHeader>
              <DialogTitle>Record return of {assetCode}</DialogTitle>
              <DialogDescription>
                Returning from {current?.employeeName}. Damaged or incomplete kit should not go
                straight back into the available pool.
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

              <SelectField
                name="conditionIn"
                label="Condition on return"
                defaultValue="GOOD"
                options={ASSET_CONDITIONS.map((c) => ({ value: c, label: titleCase(c) }))}
                errors={errors.conditionIn}
              />
              <SelectField
                name="nextStatus"
                label="Put the asset into"
                defaultValue="AVAILABLE"
                options={[
                  { value: "AVAILABLE", label: "Available pool" },
                  { value: "UNDER_REPAIR", label: "Under repair" },
                  { value: "LOST", label: "Lost" },
                  { value: "RETIRED", label: "Retired" },
                ]}
                errors={errors.nextStatus}
              />
              <TextField
                name="missingAccessories"
                label="Missing accessories"
                hint={current?.accessories ? `Issued with: ${current.accessories}` : undefined}
                errors={errors.missingAccessories}
              />
              <TextAreaField name="remarks" label="Remarks" errors={errors.remarks} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReturnOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Recording…" : "Record return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
