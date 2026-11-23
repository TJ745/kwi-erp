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
  registrationNo: string | null;
  vatNumber: string | null;
  addressLine: string | null;
  nameAr: string | null;
  addressAr: string | null;
  cityAr: string | null;
  headOfficeCity: string | null;
  headOfficeCityAr: string | null;
  signatoryName: string | null;
  signatoryNameAr: string | null;
  signatoryTitle: string | null;
  signatoryTitleAr: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: string;
};

export function CompanyDialog({ mode, company }: { mode: "create" | "edit"; company?: Company }) {
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
      registrationNo: readString(fd, "registrationNo"),
      vatNumber: readString(fd, "vatNumber"),
      addressLine: readString(fd, "addressLine"),
      nameAr: readString(fd, "nameAr"),
      addressAr: readString(fd, "addressAr"),
      cityAr: readString(fd, "cityAr"),
      headOfficeCity: readString(fd, "headOfficeCity"),
      headOfficeCityAr: readString(fd, "headOfficeCityAr"),
      signatoryName: readString(fd, "signatoryName"),
      signatoryNameAr: readString(fd, "signatoryNameAr"),
      signatoryTitle: readString(fd, "signatoryTitle"),
      signatoryTitleAr: readString(fd, "signatoryTitleAr"),
      phone: readString(fd, "phone"),
      email: readString(fd, "email"),
      website: readString(fd, "website"),
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
              The code is used throughout the system and in report filters. It cannot clash with an
              existing company.
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

            <TextField
              name="nameAr"
              label="Registered name (Arabic)"
              hint="Printed on Arabic letters and contracts."
              defaultValue={company?.nameAr ?? ""}
              errors={errors.nameAr}
            />

            <TextField
              name="addressLine"
              label="Address"
              hint="Street address as it should appear on documents."
              defaultValue={company?.addressLine ?? ""}
              errors={errors.addressLine}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                name="phone"
                label="Phone"
                defaultValue={company?.phone ?? ""}
                errors={errors.phone}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                defaultValue={company?.email ?? ""}
                errors={errors.email}
              />
              <TextField
                name="website"
                label="Website"
                defaultValue={company?.website ?? ""}
                errors={errors.website}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="crNumber"
                label="CR number"
                defaultValue={company?.crNumber ?? ""}
                errors={errors.crNumber}
              />
              <TextField
                name="vatNumber"
                label="VAT number"
                hint="Printed on letters and invoices."
                defaultValue={company?.vatNumber ?? ""}
                errors={errors.vatNumber}
              />
              <TextField
                name="registrationNo"
                label="Registration number"
                defaultValue={company?.registrationNo ?? ""}
                errors={errors.registrationNo}
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
                defaultValue={company?.country ?? "SA"}
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

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">Employment contract details</legend>
              <p className="text-muted-foreground text-xs">
                Printed in the contract preamble and signature page. The English address above is
                used for the English side.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="addressAr"
                  label="Address (Arabic)"
                  defaultValue={company?.addressAr ?? ""}
                  errors={errors.addressAr}
                  className="sm:col-span-2"
                />
                <TextField
                  name="cityAr"
                  label="City (Arabic)"
                  hint="Where contracts are signed."
                  defaultValue={company?.cityAr ?? ""}
                  errors={errors.cityAr}
                />
                <div />
                <TextField
                  name="headOfficeCity"
                  label="Head office city"
                  defaultValue={company?.headOfficeCity ?? ""}
                  errors={errors.headOfficeCity}
                />
                <TextField
                  name="headOfficeCityAr"
                  label="Head office city (Arabic)"
                  defaultValue={company?.headOfficeCityAr ?? ""}
                  errors={errors.headOfficeCityAr}
                />
                <TextField
                  name="signatoryName"
                  label="Signatory"
                  placeholder="Mr. Mohammad Al Kuhaimi"
                  defaultValue={company?.signatoryName ?? ""}
                  errors={errors.signatoryName}
                />
                <TextField
                  name="signatoryNameAr"
                  label="Signatory (Arabic)"
                  placeholder="السيد/ محمد أحمد الكحيمي"
                  defaultValue={company?.signatoryNameAr ?? ""}
                  errors={errors.signatoryNameAr}
                />
                <TextField
                  name="signatoryTitle"
                  label="Signatory title"
                  placeholder="President"
                  defaultValue={company?.signatoryTitle ?? ""}
                  errors={errors.signatoryTitle}
                />
                <TextField
                  name="signatoryTitleAr"
                  label="Signatory title (Arabic)"
                  placeholder="الرئيس"
                  defaultValue={company?.signatoryTitleAr ?? ""}
                  errors={errors.signatoryTitleAr}
                />
              </div>
            </fieldset>

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
