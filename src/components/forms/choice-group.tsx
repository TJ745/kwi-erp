"use client";

import { cn } from "@/lib/utils";

/**
 * A row of native radio buttons (or checkboxes with `multiple`), for the
 * tick-box questions of printed forms. Read back with FormData: `get` for a
 * radio group, `getAll` for checkboxes. A radio group can be cleared with
 * its "—" option, since a form may leave a question blank.
 */
export function ChoiceGroup({
  name,
  label,
  options,
  defaultValue,
  multiple = false,
  allowBlank = true,
  className,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | readonly string[] | undefined;
  multiple?: boolean;
  allowBlank?: boolean;
  className?: string | undefined;
}) {
  const selected = new Set(
    typeof defaultValue === "string" ? [defaultValue] : (defaultValue ?? []),
  );
  const all = multiple || !allowBlank ? options : [...options, { value: "", label: "—" }];

  return (
    <fieldset className={cn("space-y-1.5", className)}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {all.map((o) => (
          <label key={o.value || "blank"} className="flex items-center gap-1.5 text-sm">
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={o.value}
              defaultChecked={
                selected.has(o.value) || (!multiple && o.value === "" && selected.size === 0)
              }
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
