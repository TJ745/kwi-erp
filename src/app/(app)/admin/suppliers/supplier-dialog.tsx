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
import { readString } from "@/lib/form-data";
import { createSupplierAction, updateSupplierAction } from "@/server/actions/vendors";
import { SupplierFormFields, type SupplierValues } from "./supplier-form-fields";

export function SupplierDialog({
  companies,
  categories,
  supplier,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  categories: { id: string; name: string }[];
  supplier?: SupplierValues | undefined;
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
      code: readString(fd, "code"),
      name: readString(fd, "name"),
      contactPerson: readString(fd, "contactPerson"),
      phone: readString(fd, "phone"),
      email: readString(fd, "email"),
      companyId: readString(fd, "companyId"),
      categoryId: readString(fd, "categoryId"),
      paymentType: readString(fd, "paymentType"),
      creditDays: readString(fd, "creditDays"),
      status: readString(fd, "status"),
      notes: readString(fd, "notes"),
    };

    startTransition(async () => {
      const result = supplier
        ? await updateSupplierAction({ ...values, id: supplier.id })
        : await createSupplierAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(supplier ? "Supplier updated." : "Supplier added.");
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
          Add supplier
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
              <DialogDescription>
                Credit terms require a period, so invoices can be aged correctly.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive mb-4 rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              <SupplierFormFields
                companies={companies}
                categories={categories}
                defaults={supplier}
                errors={errors}
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
                {pending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
