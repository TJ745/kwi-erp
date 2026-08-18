"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type EntityOption = { value: string; label: string; hint?: string | undefined };

/**
 * An async, permission-filtered picker.
 *
 * The selects it replaces ship every candidate to the browser on page load,
 * which is fine at thirty employees and not at three thousand. This asks the
 * server as the user types, so the payload is bounded by what they can read
 * rather than by how many records exist.
 *
 * The value is posted through a hidden input, matching `SelectField`, so a form
 * built from `FormData` keeps working without special handling.
 */
export function EntitySelect({
  name,
  label,
  placeholder = "Search…",
  emptyLabel = "No matches",
  clearLabel = "None",
  allowClear = true,
  required = false,
  hint,
  errors,
  defaultValue,
  defaultLabel,
  search,
}: {
  name: string;
  label: string;
  placeholder?: string;
  emptyLabel?: string;
  clearLabel?: string;
  allowClear?: boolean;
  required?: boolean;
  hint?: string | undefined;
  errors?: string[] | undefined;
  /** Current value, if the form is editing an existing record. */
  defaultValue?: string | undefined;
  /** Its label, so the field can render before any search has run. */
  defaultLabel?: string | undefined;
  /** Queries the server. Debounced by this component. */
  search: (query: string) => Promise<EntityOption[]>;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<EntityOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<EntityOption | null>(
    defaultValue && defaultLabel ? { value: defaultValue, label: defaultLabel } : null,
  );

  const hasError = Boolean(errors?.length);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // Debounced, and every response checks it is still the newest before
  // rendering: a slow query for "ah" must not land after a fast one for "ahmed"
  // and replace the right results with stale ones.
  React.useEffect(() => {
    if (!open) return;

    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void search(query.trim())
        .then((results) => {
          if (!current) return;
          setOptions(results);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 200);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, open, search]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {/* Posted with the form, exactly as SelectField does. */}
      <input type="hidden" name={name} value={selected?.value ?? ""} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={hasError}
            aria-describedby={
              [hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") ||
              undefined
            }
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              hasError && "border-destructive",
            )}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          {/* Server-side filtering, so cmdk must not filter again. */}
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              {loading ? (
                <div className="text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  Searching…
                </div>
              ) : (
                <CommandEmpty>{emptyLabel}</CommandEmpty>
              )}

              {allowClear && selected ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    setSelected(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 size-3.5" />
                  {clearLabel}
                </CommandItem>
              ) : null}

              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setSelected(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-3.5",
                      selected?.value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {option.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="text-destructive text-xs">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}
