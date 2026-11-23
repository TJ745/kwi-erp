"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, UserCheck } from "lucide-react";
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
import { DateField, SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { EMPLOYMENT_TYPES, GENDERS } from "@/lib/schemas/hiring";
import { convertOfferAction, deleteJobOfferAction } from "@/server/actions/hiring";
import { OfferDialog, type InterviewPick, type OfferValues } from "./offer-dialog";

export function OfferRowActions({
  offer,
  companies,
  positions,
  departments,
  descriptions,
  interviews,
  canManage,
  canConvert,
}: {
  offer: OfferValues;
  companies: { id: string; code: string; name: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  departments: { id: string; name: string; companyId: string }[];
  descriptions: { id: string; title: string }[];
  interviews: InterviewPick[];
  canManage: boolean;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  // Only an accepted, not-yet-converted offer can become a person.
  const mayConvert = canConvert && offer.status === "ACCEPTED" && !offer.isConverted;

  // A guessed first/last split would put fiction in the permanent record, so
  // the candidate's single name field is only a starting point here.
  const [first = "", ...rest] = offer.candidateName.trim().split(/\s+/);
  const suggestedLast = rest.join(" ");

  const departmentsForCompany = departments.filter((d) => d.companyId === offer.companyId);

  function onConvert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await convertOfferAction({
        id: offer.id,
        employeeNo: readString(fd, "employeeNo"),
        firstName: readString(fd, "firstName"),
        lastName: readString(fd, "lastName"),
        gender: readString(fd, "gender"),
        nationality: readString(fd, "nationality"),
        joiningDate: readString(fd, "joiningDate"),
        employmentType: readString(fd, "employmentType"),
        departmentId: readString(fd, "departmentId"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(`Created employee ${result.data.employeeNo}.`);
      setConvertOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteJobOfferAction({ id: offer.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Offer deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Offer actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {mayConvert ? (
            <DropdownMenuItem
              onSelect={() => {
                setConvertOpen(true);
              }}
            >
              <UserCheck className="size-4" />
              Convert to employee
            </DropdownMenuItem>
          ) : null}

          {canManage ? (
            <DropdownMenuItem
              // A converted offer is the record of what someone was hired on.
              disabled={offer.isConverted}
              onSelect={() => {
                setEditOpen(true);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          ) : null}

          {canManage ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={offer.isConverted || pending}
              onSelect={() => {
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <OfferDialog
        companies={companies}
        positions={positions}
        descriptions={descriptions}
        interviews={interviews}
        offer={offer}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onConvert} noValidate>
            <DialogHeader>
              <DialogTitle>Convert {offer.candidateName} to an employee</DialogTitle>
              <DialogDescription>
                This creates a permanent employee record and can only be done once. The fields below
                are the ones an offer cannot supply — check them rather than accepting the
                suggestions.
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
                <TextField
                  name="employeeNo"
                  label="Employee ID"
                  required
                  hint="The company's own staff number, e.g. KWI-014."
                  errors={errors.employeeNo}
                  className="sm:col-span-2"
                />
                <TextField
                  name="firstName"
                  label="First name"
                  required
                  defaultValue={first}
                  errors={errors.firstName}
                />
                <TextField
                  name="lastName"
                  label="Last name"
                  required
                  defaultValue={suggestedLast}
                  errors={errors.lastName}
                />
                <SelectField
                  name="gender"
                  label="Gender"
                  required
                  options={GENDERS.map((g) => ({
                    value: g,
                    label: g.charAt(0) + g.slice(1).toLowerCase(),
                  }))}
                  errors={errors.gender}
                />
                <TextField
                  name="nationality"
                  label="Nationality"
                  required
                  hint="Two-letter country code, e.g. SA, IN, PK."
                  errors={errors.nationality}
                />
                <DateField
                  name="joiningDate"
                  label="Joining date"
                  required
                  defaultValue={offer.proposedJoiningDate ?? ""}
                  errors={errors.joiningDate}
                />
                <SelectField
                  name="employmentType"
                  label="Employment type"
                  required
                  options={EMPLOYMENT_TYPES.map((t) => ({
                    value: t,
                    label: t.replace(/_/g, " ").toLowerCase(),
                  }))}
                  defaultValue="FULL_TIME"
                  errors={errors.employmentType}
                />
                <SelectField
                  name="departmentId"
                  label="Department"
                  placeholder="Unassigned"
                  options={departmentsForCompany.map((d) => ({
                    value: d.id,
                    label: d.name,
                  }))}
                  errors={errors.departmentId}
                  className="sm:col-span-2"
                />
              </div>

              <p className="text-muted-foreground text-xs">
                The position and contact details carry over from the offer. A contract — including
                salary — is added separately from HR → Contracts.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConvertOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
