"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Form primitives wired for accessibility and server-returned field errors.
 *
 * Every input gets a label, an id, and `aria-describedby`/`aria-invalid`, so
 * error text is announced rather than merely coloured red. Using these instead
 * of raw inputs is what keeps ~40 future forms consistent.
 */

type BaseProps = {
  name: string;
  label: string;
  hint?: string | undefined;
  errors?: string[] | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
};

function FieldFrame({
  name,
  label,
  hint,
  errors,
  required,
  className,
  children,
}: BaseProps & { children: (ids: { id: string; describedBy?: string }) => React.ReactNode }) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(errors?.length);
  const describedBy = hasError ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children(describedBy === undefined ? { id } : { id, describedBy })}
      {hasError ? (
        <p id={errorId} className="text-destructive text-xs">
          {errors?.[0]}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  type = "text",
  defaultValue,
  placeholder,
  ...base
}: BaseProps & {
  type?: string;
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <FieldFrame {...base}>
      {({ id, describedBy }) => (
        <Input
          id={id}
          name={base.name}
          type={type}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder ?? ""}
          required={base.required ?? false}
          aria-invalid={Boolean(base.errors?.length)}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
        />
      )}
    </FieldFrame>
  );
}

/** Dates use a native picker: consistent, keyboard-friendly, no extra bundle. */
export function DateField({
  defaultValue,
  ...base
}: BaseProps & { defaultValue?: Date | string | null | undefined }) {
  const value =
    defaultValue instanceof Date
      ? defaultValue.toISOString().slice(0, 10)
      : (defaultValue ?? "");

  return <TextField {...base} type="date" defaultValue={value} />;
}

export function TextAreaField({
  defaultValue,
  rows = 3,
  onChange,
  ...base
}: BaseProps & {
  defaultValue?: string | undefined;
  rows?: number;
  /** Notified on every keystroke, for live hints. The field stays uncontrolled. */
  onChange?: ((value: string) => void) | undefined;
}) {
  return (
    <FieldFrame {...base}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          name={base.name}
          rows={rows}
          defaultValue={defaultValue ?? ""}
          {...(onChange
            ? {
                onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
                  onChange(event.target.value);
                },
              }
            : {})}
          aria-invalid={Boolean(base.errors?.length)}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
      )}
    </FieldFrame>
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  options,
  defaultValue,
  placeholder = "Select…",
  ...base
}: BaseProps & {
  options: readonly SelectOption[];
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
}) {
  // Controlled so the value can be posted through a hidden input: Radix Select
  // is not a native form control.
  const [value, setValue] = React.useState(defaultValue ?? "");

  return (
    <FieldFrame {...base}>
      {({ id, describedBy }) => (
        <>
          <input type="hidden" name={base.name} value={value} />
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger
              id={id}
              className="w-full"
              aria-invalid={Boolean(base.errors?.length)}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </FieldFrame>
  );
}

/** Groups fields under a heading, with a consistent two-column grid. */
export function FieldSet({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-sm font-semibold">{legend}</legend>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
