"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { extractVariables, TEMPLATE_VARIABLES } from "@/lib/templates";
import { LETTER_TYPES, LETTER_TYPE_LABELS } from "@/lib/schemas/letters";
import { readString } from "@/lib/form-data";
import { createTemplateAction, updateTemplateAction } from "@/server/actions/letters";

type Template = {
  id: string;
  key: string;
  name: string;
  type: string;
  companyId: string | null;
  bodyHtml: string;
  bodyHtmlAr: string | null;
  isActive: boolean;
};

export function TemplateForm({
  companies,
  template,
}: {
  companies: { id: string; name: string; code: string }[];
  template?: Template;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  // Live so a mistyped placeholder is caught while writing, not after a letter
  // has already gone out with `{{salry}}` printed on it.
  const [body, setBody] = React.useState(template?.bodyHtml ?? "");
  const [bodyAr, setBodyAr] = React.useState(template?.bodyHtmlAr ?? "");
  const used = React.useMemo(() => extractVariables(`${body} ${bodyAr}`), [body, bodyAr]);

  // Radix Checkbox is not a native form control, so its value is held here
  // rather than read back from FormData.
  const [isActive, setIsActive] = React.useState(template?.isActive ?? true);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      key: readString(fd, "key"),
      name: readString(fd, "name"),
      type: readString(fd, "type"),
      companyId: readString(fd, "companyId"),
      bodyHtml: readString(fd, "bodyHtml"),
      bodyHtmlAr: readString(fd, "bodyHtmlAr"),
      isActive,
    };

    startTransition(async () => {
      const result = template
        ? await updateTemplateAction({ ...values, id: template.id })
        : await createTemplateAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(template ? "Template updated." : "Template created.");
      router.push("/settings/templates");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
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
          name="name"
          label="Template name"
          required
          defaultValue={template?.name ?? ""}
          errors={errors.name}
        />
        <TextField
          name="key"
          label="Key"
          required
          hint="Stable identifier used by seeds and automations. Lowercase, no spaces."
          defaultValue={template?.key ?? ""}
          errors={errors.key}
        />
        <SelectField
          name="type"
          label="Letter type"
          required
          options={LETTER_TYPES.map((value) => ({
            value,
            label: LETTER_TYPE_LABELS[value],
          }))}
          defaultValue={template?.type ?? "EMPLOYMENT_LETTER"}
          errors={errors.type}
        />
        <SelectField
          name="companyId"
          label="Company"
          hint="Leave blank to share this template across every company."
          placeholder="All companies"
          options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          defaultValue={template?.companyId ?? ""}
          errors={errors.companyId}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(checked) => {
            setIsActive(checked === true);
          }}
        />
        <Label htmlFor="isActive" className="font-normal">
          Active — available for generating letters
        </Label>
      </div>

      <TextAreaField
        name="bodyHtml"
        label="Body (English)"
        required
        rows={16}
        hint="HTML. Scripts, iframes, and event handlers are stripped on save."
        defaultValue={template?.bodyHtml ?? ""}
        errors={errors.bodyHtml}
        onChange={setBody}
      />

      <TextAreaField
        name="bodyHtmlAr"
        label="Body (Arabic)"
        rows={12}
        hint="Optional. Rendered right-to-left below the English body."
        defaultValue={template?.bodyHtmlAr ?? ""}
        errors={errors.bodyHtmlAr}
        onChange={setBodyAr}
      />

      <VariableHelp used={used} />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : template ? "Save changes" : "Create template"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.push("/settings/templates");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function VariableHelp({ used }: { used: { known: string[]; unknown: string[] } }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">Available placeholders</h2>
        <p className="text-muted-foreground text-xs">
          Anything not on this list is printed verbatim, so a typo is visible on the letter
          rather than silently blank.
        </p>
      </div>

      {used.unknown.length > 0 ? (
        <p className="text-status-expired text-xs" role="alert">
          Not recognised: {used.unknown.map((key) => `{{${key}}}`).join(", ")}
        </p>
      ) : null}

      <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(TEMPLATE_VARIABLES).map(([key, label]) => (
          <li key={key} className="flex items-baseline gap-2">
            <code
              className={
                used.known.includes(key)
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }
            >
              {`{{${key}}}`}
            </code>
            <span className="text-muted-foreground truncate">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
