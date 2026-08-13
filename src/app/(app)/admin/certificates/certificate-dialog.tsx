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
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { RECORD_STATUSES } from "@/lib/schemas/compliance";
import {
  createCertificateAction,
  updateCertificateAction,
} from "@/server/actions/compliance";

export type CertificateValues = {
  id: string;
  companyId: string;
  certificateTypeId: string;
  certificateNo: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string | null;
  status: string;
  notes: string | null;
};

export function CertificateDialog({
  companies,
  types,
  certificate,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  types: { id: string; name: string }[];
  certificate?: CertificateValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      certificateTypeId: readString(fd, "certificateTypeId"),
      certificateNo: readString(fd, "certificateNo"),
      issueDate: readString(fd, "issueDate"),
      expiryDate: readString(fd, "expiryDate"),
      issuingAuthority: readString(fd, "issuingAuthority"),
      status: readString(fd, "status"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = certificate
        ? await updateCertificateAction({ ...values, id: certificate.id })
        : await createCertificateAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(certificate ? "Certificate updated." : "Certificate added.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {!isControlled ? (
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          Add certificate
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {certificate ? "Edit certificate" : "Add certificate"}
              </DialogTitle>
              <DialogDescription>
                An active certificate appears on the expiry register. Renewing it means
                editing the expiry date here — the reminders follow automatically.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  name="certificateTypeId"
                  label="Certificate type"
                  required
                  options={types.map((t) => ({ value: t.id, label: t.name }))}
                  defaultValue={certificate?.certificateTypeId ?? ""}
                  errors={errors.certificateTypeId}
                />
                <TextField
                  name="certificateNo"
                  label="Certificate number"
                  required
                  defaultValue={certificate?.certificateNo ?? ""}
                  errors={errors.certificateNo}
                />
                <SelectField
                  name="companyId"
                  label="Company"
                  required
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.name}`,
                  }))}
                  defaultValue={certificate?.companyId ?? companies[0]?.id ?? ""}
                  errors={errors.companyId}
                />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  hint="Only ACTIVE certificates generate renewal reminders."
                  options={RECORD_STATUSES.map((s) => ({ value: s, label: s }))}
                  defaultValue={certificate?.status ?? "ACTIVE"}
                  errors={errors.status}
                />
                <DateField
                  name="issueDate"
                  label="Issue date"
                  required
                  defaultValue={certificate?.issueDate ?? ""}
                  errors={errors.issueDate}
                />
                <DateField
                  name="expiryDate"
                  label="Expiry date"
                  required
                  defaultValue={certificate?.expiryDate ?? ""}
                  errors={errors.expiryDate}
                />
                <TextField
                  name="issuingAuthority"
                  label="Issuing authority"
                  defaultValue={certificate?.issuingAuthority ?? ""}
                  errors={errors.issuingAuthority}
                  className="sm:col-span-2"
                />
              </div>

              <TextAreaField
                name="notes"
                label="Notes"
                defaultValue={certificate?.notes ?? ""}
                errors={errors.notes}
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
                {pending ? "Saving…" : certificate ? "Save changes" : "Add certificate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
