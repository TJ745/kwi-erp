"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/field";
import type { ActionResult } from "@/lib/result";
import { readString } from "@/lib/form-data";

/**
 * One dialog driven by a field list.
 *
 * The simple register records (IP phones, CCTV, device IPs, electricity
 * meters) differ only in their fields — writing a near-identical dialog for
 * each would mean several places to forget an error state or an
 * aria attribute. The field descriptions stay in the page, which is where the
 * domain lives; the mechanics stay here.
 */
export type FieldSpec =
  | {
      kind: "text" | "date";
      name: string;
      label: string;
      required?: boolean;
      hint?: string;
      wide?: boolean;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      required?: boolean;
      hint?: string;
      placeholder?: string;
      wide?: boolean;
    }
  | { kind: "textarea"; name: string; label: string; rows?: number; hint?: string }
  | { kind: "checkbox"; name: string; label: string };

export type RecordValues = Record<string, string | boolean | null>;

export function RecordDialog({
  title,
  description,
  triggerLabel,
  fields,
  values,
  submit,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  description: string;
  triggerLabel: string;
  fields: readonly FieldSpec[];
  values?: RecordValues | undefined;
  /** Receives every field by name; the page maps them to its own action. */
  submit: (
    data: Record<string, string | boolean>,
    id: string | undefined,
  ) => Promise<ActionResult<unknown>>;
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

  // Checkboxes are Radix components, not native inputs, so their values are
  // held here rather than read back from FormData.
  const [checks, setChecks] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const field of fields) {
      if (field.kind === "checkbox") {
        initial[field.name] = values?.[field.name] === true;
      }
    }
    return initial;
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const data: Record<string, string | boolean> = {};
    for (const field of fields) {
      data[field.name] =
        field.kind === "checkbox" ? (checks[field.name] ?? false) : readString(fd, field.name);
    }

    const id = typeof values?.id === "string" ? values.id : undefined;

    startTransition(async () => {
      const result = await submit(data, id);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }
      toast.success(id ? "Saved." : "Added.");
      setOpen(false);
      router.refresh();
    });
  }

  const stringValue = (name: string): string => {
    const value = values?.[name];
    return typeof value === "string" ? value : "";
  };

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
          {triggerLabel}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{values ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
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
                {fields.map((field) => {
                  if (field.kind === "textarea" || field.kind === "checkbox") return null;

                  // `key` is passed explicitly rather than through the spread:
                  // inside an object literal ESLint cannot see it, and a
                  // missing key here would silently break list reconciliation.
                  const shared = {
                    name: field.name,
                    label: field.label,
                    required: field.required ?? false,
                    errors: errors[field.name],
                    ...(field.hint ? { hint: field.hint } : {}),
                    ...(field.wide ? { className: "sm:col-span-2" } : {}),
                  };

                  if (field.kind === "select") {
                    return (
                      <SelectField
                        key={field.name}
                        {...shared}
                        options={field.options}
                        defaultValue={stringValue(field.name)}
                        {...(field.placeholder ? { placeholder: field.placeholder } : {})}
                      />
                    );
                  }

                  if (field.kind === "date") {
                    return (
                      <DateField
                        key={field.name}
                        {...shared}
                        defaultValue={stringValue(field.name)}
                      />
                    );
                  }

                  return (
                    <TextField
                      key={field.name}
                      {...shared}
                      defaultValue={stringValue(field.name)}
                    />
                  );
                })}
              </div>

              {fields
                .filter((f) => f.kind === "checkbox")
                .map((field) => (
                  <div key={field.name} className="flex items-center gap-2">
                    <Checkbox
                      id={`check-${field.name}`}
                      checked={checks[field.name] ?? false}
                      onCheckedChange={(checked) => {
                        setChecks((c) => ({ ...c, [field.name]: checked === true }));
                      }}
                    />
                    <Label htmlFor={`check-${field.name}`} className="font-normal">
                      {field.label}
                    </Label>
                  </div>
                ))}

              {fields
                .filter((f) => f.kind === "textarea")
                .map((field) => (
                  <TextAreaField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rows={field.kind === "textarea" ? (field.rows ?? 3) : 3}
                    {...(field.hint ? { hint: field.hint } : {})}
                    defaultValue={stringValue(field.name)}
                    errors={errors[field.name]}
                  />
                ))}
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
                {pending ? "Saving…" : values ? "Save changes" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
