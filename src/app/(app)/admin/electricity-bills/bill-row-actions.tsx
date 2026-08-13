"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { deleteBillAction, markBillPaidAction } from "@/server/actions/compliance";
import { BillDialog, type BillValues } from "./bill-dialog";

export function BillRowActions({
  bill,
  companies,
  accommodations,
}: {
  bill: BillValues;
  companies: { id: string; code: string; name: string }[];
  accommodations: { id: string; name: string; companyId: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [payError, setPayError] = React.useState<string | null>(null);

  function onPay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await markBillPaidAction({
        id: bill.id,
        paidDate: readString(fd, "paidDate"),
      });
      if (!result.success) {
        setPayError(result.error);
        return;
      }
      toast.success("Bill marked paid.");
      setPayOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteBillAction({ id: bill.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Bill deleted.");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Actions for meter ${bill.meterNumber}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {bill.status !== "PAID" ? (
            <DropdownMenuItem
              onSelect={() => {
                setPayOpen(true);
              }}
            >
              <BadgeCheck className="size-4" />
              Mark paid
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BillDialog
        companies={companies}
        accommodations={accommodations}
        bill={bill}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <form onSubmit={onPay} noValidate>
            <DialogHeader>
              <DialogTitle>Mark bill paid</DialogTitle>
              <DialogDescription>
                {bill.amount} {bill.currency} for meter {bill.meterNumber}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {payError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {payError}
                </div>
              ) : null}
              <DateField
                name="paidDate"
                label="Payment date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPayOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Mark paid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this bill?</DialogTitle>
            <DialogDescription>
              Meter {bill.meterNumber} at {bill.location}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
