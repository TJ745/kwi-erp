"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { upsertIqamaAction, upsertPassportAction } from "@/server/actions/employees";

type IqamaValues = {
  iqamaNumber: string;
  profession: string | null;
  professionAr: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  sponsorName: string | null;
  notes: string | null;
};

type PassportValues = {
  passportNumber: string;
  issueCountry: string | null;
  issuePlace: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
};

/**
 * Iqama and passport editing.
 *
 * Saving either one refreshes the ExpiryIndex projection in the same
 * transaction, so the dashboard and reminder engine see the new date
 * immediately (ADR-005).
 */
export function IdentityDocuments({
  employeeId,
  canEdit,
  iqama,
  passport,
  iqamaExpiryBadge,
  passportExpiryBadge,
}: {
  employeeId: string;
  canEdit: boolean;
  iqama: IqamaValues | null;
  passport: PassportValues | null;
  iqamaExpiryBadge: React.ReactNode;
  passportExpiryBadge: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <IqamaCard
        employeeId={employeeId}
        canEdit={canEdit}
        values={iqama}
        badge={iqamaExpiryBadge}
      />
      <PassportCard
        employeeId={employeeId}
        canEdit={canEdit}
        values={passport}
        badge={passportExpiryBadge}
      />
    </div>
  );
}

function IqamaCard({
  employeeId,
  canEdit,
  values,
  badge,
}: {
  employeeId: string;
  canEdit: boolean;
  values: IqamaValues | null;
  badge: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await upsertIqamaAction({
        employeeId,
        iqamaNumber: readString(fd, "iqamaNumber"),
        profession: readString(fd, "profession"),
        professionAr: readString(fd, "professionAr"),
        issueDate: readString(fd, "issueDate"),
        expiryDate: readString(fd, "expiryDate"),
        sponsorName: readString(fd, "sponsorName"),
        notes: readString(fd, "notes"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Iqama record saved.");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Iqama</CardTitle>
          <div className="flex items-center gap-2">
            {!editing ? badge : null}
            {canEdit && !editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {values ? "Edit" : "Add"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="iqamaNumber"
                label="Iqama number"
                required
                defaultValue={values?.iqamaNumber ?? ""}
                errors={errors.iqamaNumber}
              />
              <TextField
                name="profession"
                label="Profession"
                defaultValue={values?.profession ?? ""}
                errors={errors.profession}
              />
              <TextField
                name="professionAr"
                label="Profession (Arabic)"
                defaultValue={values?.professionAr ?? ""}
                errors={errors.professionAr}
              />
              <TextField
                name="sponsorName"
                label="Sponsor"
                defaultValue={values?.sponsorName ?? ""}
                errors={errors.sponsorName}
              />
              <DateField
                name="issueDate"
                label="Issue date"
                defaultValue={values?.issueDate ?? ""}
                errors={errors.issueDate}
              />
              <DateField
                name="expiryDate"
                label="Expiry date"
                defaultValue={values?.expiryDate ?? ""}
                errors={errors.expiryDate}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : values ? (
          <ReadOnly
            items={[
              ["Iqama number", mask(values.iqamaNumber)],
              ["Profession", values.profession],
              ["Sponsor", values.sponsorName],
              ["Issued", values.issueDate],
              ["Expires", values.expiryDate],
            ]}
          />
        ) : (
          <p className="text-muted-foreground text-sm">No Iqama record yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PassportCard({
  employeeId,
  canEdit,
  values,
  badge,
}: {
  employeeId: string;
  canEdit: boolean;
  values: PassportValues | null;
  badge: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await upsertPassportAction({
        employeeId,
        passportNumber: readString(fd, "passportNumber"),
        issueCountry: readString(fd, "issueCountry"),
        issuePlace: readString(fd, "issuePlace"),
        issueDate: readString(fd, "issueDate"),
        expiryDate: readString(fd, "expiryDate"),
        notes: readString(fd, "notes"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Passport record saved.");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Passport</CardTitle>
          <div className="flex items-center gap-2">
            {!editing ? badge : null}
            {canEdit && !editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {values ? "Edit" : "Add"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="passportNumber"
                label="Passport number"
                required
                defaultValue={values?.passportNumber ?? ""}
                errors={errors.passportNumber}
              />
              <TextField
                name="issueCountry"
                label="Issuing country"
                hint="Two-letter code, e.g. PK."
                defaultValue={values?.issueCountry ?? ""}
                errors={errors.issueCountry}
              />
              <TextField
                name="issuePlace"
                label="Place of issue"
                defaultValue={values?.issuePlace ?? ""}
                errors={errors.issuePlace}
              />
              <div />
              <DateField
                name="issueDate"
                label="Issue date"
                defaultValue={values?.issueDate ?? ""}
                errors={errors.issueDate}
              />
              <DateField
                name="expiryDate"
                label="Expiry date"
                defaultValue={values?.expiryDate ?? ""}
                errors={errors.expiryDate}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : values ? (
          <ReadOnly
            items={[
              ["Passport number", mask(values.passportNumber)],
              ["Issuing country", values.issueCountry],
              ["Place of issue", values.issuePlace],
              ["Issued", values.issueDate],
              ["Expires", values.expiryDate],
            ]}
          />
        ) : (
          <p className="text-muted-foreground text-sm">No passport record yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReadOnly({ items }: { items: [string, string | null][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="text-sm">
            {value ? value : <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * National identifiers are masked in read views (docs/SECURITY.md §10).
 * The full value is still present in the edit form, which requires
 * employees.update.
 */
function mask(value: string): string {
  if (value.length <= 4) return value;
  return `${"·".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}
