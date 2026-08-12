"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { POLICY_STATUSES } from "@/lib/schemas/insurance";
import { createPolicyAction, updatePolicyAction } from "@/server/actions/insurance";
import type { PolicyRow } from "./policy-table";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function PolicyDialog({
  companies,
  providers,
  policy,
}: {
  companies: { id: string; code: string; name: string }[];
  providers: { id: string; name: string }[];
  policy?: PolicyRow;
}) {
  const router = useRouter();
  const mode = policy ? "edit" : "create";
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(policy?.isWorking ?? true);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const payload = {
      companyId: readString(fd, "companyId"),
      providerId: readString(fd, "providerId"),
      policyNumber: readString(fd, "policyNumber"),
      className: readString(fd, "className"),
      startDate: readString(fd, "startDate"),
      expiryDate: readString(fd, "expiryDate"),
      status: readString(fd, "status") || "ACTIVE",
      isWorking,
      coverageLimit: readString(fd, "coverageLimit"),
      currency: readString(fd, "currency") || "SAR",
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = policy
        ? await updatePolicyAction({ ...payload, id: policy.id })
        : await createPolicyAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? "Policy added." : "Policy updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size={mode === "create" ? "sm" : "icon-sm"}
        variant={mode === "create" ? "default" : "ghost"}
        aria-label={mode === "edit" ? `Edit policy ${policy?.policyNumber ?? ""}` : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        {mode === "create" ? (
          <>
            <Plus />
            Add policy
          </>
        ) : (
          <Pencil />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add policy" : "Edit policy"}</DialogTitle>
            <DialogDescription>
              Status is the contractual state. &ldquo;Working&rdquo; is whether the card
              actually functions at a clinic — a policy can be in-date and not working.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="companyId"
                label="Company"
                required
                defaultValue={policy?.companyId ?? companies[0]?.id ?? ""}
                options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                errors={errors.companyId}
              />
              <SelectField
                name="providerId"
                label="Provider"
                required
                defaultValue={policy?.providerId ?? providers[0]?.id ?? ""}
                options={providers.map((p) => ({ value: p.id, label: p.name }))}
                errors={errors.providerId}
              />
              <TextField
                name="policyNumber"
                label="Policy number"
                required
                defaultValue={policy?.policyNumber ?? ""}
                errors={errors.policyNumber}
              />
              <TextField
                name="className"
                label="Class"
                hint="e.g. A, B, VIP"
                defaultValue={policy?.className ?? ""}
                errors={errors.className}
              />
              <DateField
                name="startDate"
                label="Start date"
                required
                defaultValue={policy?.startDate ?? ""}
                errors={errors.startDate}
              />
              <DateField
                name="expiryDate"
                label="Expiry date"
                required
                defaultValue={policy ? policy.expiryDate.slice(0, 10) : ""}
                errors={errors.expiryDate}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={policy?.status ?? "ACTIVE"}
                options={POLICY_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
                errors={errors.status}
              />
              <TextField
                name="coverageLimit"
                label="Coverage limit"
                hint="Numbers only."
                errors={errors.coverageLimit}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isWorking"
                checked={isWorking}
                onCheckedChange={(checked) => {
                  setIsWorking(checked === true);
                }}
              />
              <Label htmlFor="isWorking" className="font-normal">
                Currently working at clinics
              </Label>
            </div>

            <TextAreaField name="notes" label="Notes" errors={errors.notes} />

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
                {pending ? "Saving…" : mode === "create" ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
