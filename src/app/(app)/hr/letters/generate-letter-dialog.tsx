"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
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
import { SelectField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { LETTER_TYPE_LABELS, type LETTER_TYPES } from "@/lib/schemas/letters";
import { generateLetterAction, previewLetterAction } from "@/server/actions/letters";

type Preview = {
  templateName: string;
  employeeName: string;
  html: string;
  htmlAr: string | null;
  missing: string[];
  unknown: string[];
};

/**
 * Two steps on purpose. Preview writes nothing and consumes no letter number,
 * so the operator can see that {{salary}} is blank before committing a
 * sequential, permanently numbered document.
 */
export function GenerateLetterDialog({
  templates,
  employees,
}: {
  templates: { id: string; name: string; type: (typeof LETTER_TYPES)[number] }[];
  employees: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<{
    templateId: string;
    employeeId: string;
  } | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);

  function reset() {
    setErrors({});
    setFormError(null);
    setPreview(null);
    setSelection(null);
  }

  function onPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const input = {
      templateId: readString(fd, "templateId"),
      employeeId: readString(fd, "employeeId"),
    };

    startTransition(async () => {
      const result = await previewLetterAction(input);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      setSelection(input);
      setPreview(result.data);
    });
  }

  function onGenerate() {
    if (!selection) return;
    startTransition(async () => {
      const result = await generateLetterAction(selection);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      toast.success(`Generated ${result.data.letterNo}.`);
      setOpen(false);
      reset();
      router.push(`/hr/letters/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        disabled={templates.length === 0}
        onClick={() => {
          setOpen(true);
        }}
      >
        <FilePlus2 />
        Generate letter
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview ? "Preview letter" : "Generate letter"}</DialogTitle>
            <DialogDescription>
              {preview
                ? "Nothing has been saved yet. Generating assigns a permanent letter number."
                : "Pick a template and an employee. You will see a preview before anything is saved."}
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
            >
              {formError}
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4">
              {preview.missing.length > 0 ? (
                <div
                  role="alert"
                  className="border-status-warning/40 bg-status-warning/5 rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">
                    {preview.missing.length} placeholder
                    {preview.missing.length === 1 ? " has" : "s have"} no value
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {preview.missing.map((key) => `{{${key}}}`).join(", ")} will print as written.
                    Fill in the employee record first, or generate anyway.
                  </p>
                </div>
              ) : null}

              {preview.unknown.length > 0 ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">Template references unknown placeholders</p>
                  <p className="text-muted-foreground text-xs">
                    {preview.unknown.map((key) => `{{${key}}}`).join(", ")} — fix the template.
                  </p>
                </div>
              ) : null}

              <LetterPreview html={preview.html} htmlAr={preview.htmlAr} />
            </div>
          ) : (
            <form id="preview-form" onSubmit={onPreview} noValidate className="space-y-4 py-2">
              <SelectField
                name="templateId"
                label="Template"
                required
                options={templates.map((t) => ({
                  value: t.id,
                  label: `${t.name} — ${LETTER_TYPE_LABELS[t.type]}`,
                }))}
                errors={errors.templateId}
              />
              <SelectField
                name="employeeId"
                label="Employee"
                required
                options={employees.map((e) => ({ value: e.id, label: e.label }))}
                errors={errors.employeeId}
              />
            </form>
          )}

          <DialogFooter>
            {preview ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setSelection(null);
                  }}
                >
                  Back
                </Button>
                <Button onClick={onGenerate} disabled={pending}>
                  {pending ? "Generating…" : "Generate letter"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" form="preview-form" disabled={pending}>
                  {pending ? "Loading…" : "Preview"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The HTML has been sanitised server-side on save and again on render, and all
 * substituted values are escaped — see src/lib/templates.ts. This is the one
 * place the result is injected, and it is why that sanitiser is allowlist-based.
 */
function LetterPreview({ html, htmlAr }: { html: string; htmlAr: string | null }) {
  return (
    <div className="bg-background max-h-[45vh] overflow-y-auto rounded-md border p-6">
      <div className="letter-body" dangerouslySetInnerHTML={{ __html: html }} />
      {htmlAr ? (
        <>
          <hr className="my-6" />
          <div
            className="letter-body"
            dir="rtl"
            lang="ar"
            dangerouslySetInnerHTML={{ __html: htmlAr }}
          />
        </>
      ) : null}
    </div>
  );
}
