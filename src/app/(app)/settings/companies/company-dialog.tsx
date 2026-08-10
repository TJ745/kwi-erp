"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createCompanyAction, updateCompanyAction } from "@/server/actions/org";

type Company = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  city: string | null;
  crNumber: string | null;
  status: string;
};

export function CompanyDialog({
  mode,
  company,
}: {
  mode: "create" | "edit";
  company?: Company;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    const payload = {
      code: readString(fd, "code").toUpperCase(),
      name: readString(fd, "name"),
      shortName: readString(fd, "shortName"),
      city: readString(fd, "city"),
      crNumber: readString(fd, "crNumber"),
      country: readString(fd, "country") || "SA",
      status: readString(fd, "status") || "ACTIVE",
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCompanyAction(payload)
          : await updateCompanyAction({ ...payload, id: company?.id ?? "" });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Company created." : "Company updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={mode === "create" ? "default" : "outline"}
        onClick={() => {
          setOpen(true);
        }}
      >
        {mode === "create" ? <Plus /> : <Pencil />}
        {mode === "create" ? "Add company" : "Edit"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add company" : "Edit company"}</DialogTitle>
            <DialogDescription>
              The code is used throughout the system and in report filters. It cannot clash with
              an existing company.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="code"
                label="Code"
                required
                hint="Uppercase, e.g. KWI."
                defaultValue={company?.code ?? ""}
                errors={errors.code}
              />
              <TextField
                name="shortName"
                label="Short name"
                required
                defaultValue={company?.shortName ?? ""}
                errors={errors.shortName}
              />
            </div>

            <TextField
              name="name"
              label="Registered name"
              required
              defaultValue={company?.name ?? ""}
              errors={errors.name}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="crNumber"
                label="CR number"
                defaultValue={company?.crNumber ?? ""}
                errors={errors.crNumber}
              />
              <TextField
                name="city"
                label="City"
                defaultValue={company?.city ?? ""}
                errors={errors.city}
              />
              <TextField
                name="country"
                label="Country"
                hint="Two-letter code."
                defaultValue="SA"
                errors={errors.country}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={company?.status ?? "ACTIVE"}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
                errors={errors.status}
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
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
