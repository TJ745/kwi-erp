"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Landmark, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { DateField, TextField } from "@/components/forms/field";
import { maskIban } from "@/lib/bank";
import { readString } from "@/lib/form-data";
import { deleteBankDetailAction, upsertBankDetailAction } from "@/server/actions/employees";

export type BankDetail = {
  bankName: string;
  iban: string;
  accountNo: string | null;
  swift: string | null;
  verifiedAt: string | null;
};

/**
 * Payroll bank details.
 *
 * The IBAN is masked until the viewer asks for it. Everyone who reaches this
 * card already holds `employees.bank.view`, so this is not an access control —
 * it stops a full account number sitting on screen through a shoulder-surf or
 * a screen share, which is a different problem from authorisation.
 */
export function BankDetails({
  employeeId,
  detail,
  canManage,
}: {
  employeeId: string;
  detail: BankDetail | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [open, setOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  // Hide again whenever the tab loses focus — same reasoning as the vault.
  React.useEffect(() => {
    if (!revealed) return;
    function onHidden() {
      if (document.visibilityState === "hidden") setRevealed(false);
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [revealed]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await upsertBankDetailAction({
        employeeId,
        bankName: readString(fd, "bankName"),
        iban: readString(fd, "iban"),
        accountNo: readString(fd, "accountNo"),
        swift: readString(fd, "swift"),
        verifiedAt: readString(fd, "verifiedAt"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success("Bank details saved.");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteBankDetailAction({ employeeId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Bank details removed.");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Landmark className="size-4" />
          Bank details
        </CardTitle>
        {canManage ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setErrors({});
                setOpen(true);
              }}
            >
              <Pencil />
              {detail ? "Edit" : "Add"}
            </Button>
            {detail ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove bank details"
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {!detail ? (
          <p className="text-muted-foreground text-sm">
            No bank details recorded. Payroll and the employee directory report need these.
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="font-medium">{detail.bankName}</dd>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">IBAN</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-mono">{revealed ? detail.iban : maskIban(detail.iban)}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={revealed ? "Hide the IBAN" : "Show the IBAN"}
                  onClick={() => {
                    setRevealed((v) => !v);
                  }}
                >
                  {revealed ? <EyeOff /> : <Eye />}
                </Button>
              </dd>
            </div>

            {detail.accountNo ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Account number</dt>
                <dd className="font-mono">{detail.accountNo}</dd>
              </div>
            ) : null}

            {detail.swift ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">SWIFT / BIC</dt>
                <dd className="font-mono">{detail.swift}</dd>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Verified</dt>
              <dd>
                {detail.verifiedAt ? (
                  <Badge>Verified {detail.verifiedAt}</Badge>
                ) : (
                  <Badge variant="outline">Not verified</Badge>
                )}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail ? "Edit bank details" : "Add bank details"}</DialogTitle>
            <DialogDescription>
              The IBAN is checked against its country length and checksum before it is stored.
              Changing it clears the verification, because whoever checked the old account did not
              check this one.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <TextField
              name="bankName"
              label="Bank name"
              required
              defaultValue={detail?.bankName ?? ""}
              errors={errors.bankName}
            />

            <TextField
              name="iban"
              label="IBAN"
              required
              placeholder="SA03 8000 0000 6080 1016 7519"
              hint="Spaces are fine — they are stripped on save."
              defaultValue={detail?.iban ?? ""}
              errors={errors.iban}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="accountNo"
                label="Account number"
                defaultValue={detail?.accountNo ?? ""}
                errors={errors.accountNo}
              />
              <TextField
                name="swift"
                label="SWIFT / BIC"
                defaultValue={detail?.swift ?? ""}
                errors={errors.swift}
              />
            </div>

            <DateField
              name="verifiedAt"
              label="Verified on"
              hint="Set when someone has checked this against a bank letter."
              defaultValue={detail?.verifiedAt ?? ""}
              errors={errors.verifiedAt}
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
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove bank details?</DialogTitle>
            <DialogDescription>
              Payroll will have nowhere to pay this employee until new details are recorded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
