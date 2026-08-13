"use client";

import * as React from "react";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { PAYMENT_TYPES, RECORD_STATUSES } from "@/lib/schemas/vendors";

export type SupplierValues = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  companyId: string | null;
  categoryId: string | null;
  paymentType: string;
  creditDays: number | null;
  status: string;
  notes: string | null;
};

/**
 * Shared by the create and edit dialogs so the two cannot drift — a field added
 * to one but not the other silently stops being editable.
 */
export function SupplierFormFields({
  companies,
  categories,
  defaults,
  errors,
}: {
  companies: { id: string; code: string; name: string }[];
  categories: { id: string; name: string }[];
  defaults?: SupplierValues | undefined;
  errors: Record<string, string[]>;
}) {
  // Credit days only mean something for credit terms, so the field appears
  // when it applies rather than sitting there inert.
  const [paymentType, setPaymentType] = React.useState(defaults?.paymentType ?? "CASH");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="code"
          label="Code"
          required
          hint="Uppercase letters, digits, hyphens."
          defaultValue={defaults?.code ?? ""}
          errors={errors.code}
        />
        <TextField
          name="name"
          label="Supplier name"
          required
          defaultValue={defaults?.name ?? ""}
          errors={errors.name}
        />
        <TextField
          name="contactPerson"
          label="Contact person"
          defaultValue={defaults?.contactPerson ?? ""}
          errors={errors.contactPerson}
        />
        <TextField
          name="phone"
          label="Phone"
          defaultValue={defaults?.phone ?? ""}
          errors={errors.phone}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          defaultValue={defaults?.email ?? ""}
          errors={errors.email}
        />
        <SelectField
          name="categoryId"
          label="Category"
          placeholder="Uncategorised"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          defaultValue={defaults?.categoryId ?? ""}
          errors={errors.categoryId}
        />
        <SelectField
          name="companyId"
          label="Company"
          hint="Leave blank to share across every company."
          placeholder="All companies"
          options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          defaultValue={defaults?.companyId ?? ""}
          errors={errors.companyId}
        />
        <SelectField
          name="status"
          label="Status"
          required
          options={RECORD_STATUSES.map((s) => ({ value: s, label: s }))}
          defaultValue={defaults?.status ?? "ACTIVE"}
          errors={errors.status}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="field-paymentType">
            Payment terms<span className="text-destructive">*</span>
          </label>
          <select
            id="field-paymentType"
            name="paymentType"
            value={paymentType}
            onChange={(e) => {
              setPaymentType(e.target.value);
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            {PAYMENT_TYPES.map((p) => (
              <option key={p} value={p}>
                {p === "CASH" ? "Cash" : "Credit"}
              </option>
            ))}
          </select>
          {errors.paymentType?.[0] ? (
            <p className="text-destructive text-xs">{errors.paymentType[0]}</p>
          ) : null}
        </div>

        {paymentType === "CREDIT" ? (
          <TextField
            name="creditDays"
            label="Credit period (days)"
            required
            defaultValue={defaults?.creditDays != null ? String(defaults.creditDays) : ""}
            errors={errors.creditDays}
          />
        ) : (
          // Still submitted, so switching back to Cash clears a stale value
          // rather than leaving credit terms attached to a cash supplier.
          <input type="hidden" name="creditDays" value="" />
        )}
      </div>

      <TextAreaField
        name="notes"
        label="Notes"
        defaultValue={defaults?.notes ?? ""}
        errors={errors.notes}
      />
    </div>
  );
}
