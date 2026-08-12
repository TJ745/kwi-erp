"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportFilterKey } from "@/lib/reports";

/**
 * Filters live in the URL, not in component state.
 *
 * That makes a filtered report linkable and, more importantly, lets the export
 * button hand the exact same query string to the export route — the screen and
 * the file cannot end up filtered differently.
 */
export function ReportFilterBar({
  reportId,
  filters,
  companies,
  departments,
  current,
}: {
  reportId: string;
  filters: readonly ReportFilterKey[];
  companies: { id: string; code: string; name: string }[];
  departments: { id: string; name: string; companyId: string }[];
  current: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  // "" is the "any" option; Radix Select cannot hold an empty item value, so
  // the sentinel is mapped at both ends rather than stored.
  const ANY = "__any";

  function apply(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(current);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "" || value === ANY) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`/reports/${reportId}${qs ? `?${qs}` : ""}`);
    });
  }

  const departmentOptions = current.companyId
    ? departments.filter((d) => d.companyId === current.companyId)
    : departments;

  const hasAny = Object.values(current).some((v) => v !== "");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      {filters.includes("companyId") ? (
        <Field label="Company">
          <Select
            value={current.companyId ?? ANY}
            onValueChange={(value) => {
              // Clearing the department too: a department from another company
              // would silently return nothing.
              apply({ companyId: value, departmentId: undefined });
            }}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {filters.includes("departmentId") ? (
        <Field label="Department">
          <Select
            value={current.departmentId ?? ANY}
            onValueChange={(value) => {
              apply({ departmentId: value });
            }}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All departments</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {filters.includes("status") ? (
        <Field label="Status">
          <Input
            name="status"
            defaultValue={current.status ?? ""}
            placeholder="e.g. ACTIVE"
            className="h-8 w-36 uppercase"
            onBlur={(event) => {
              apply({ status: event.target.value.toUpperCase() });
            }}
          />
        </Field>
      ) : null}

      {filters.includes("from") ? (
        <Field label="From">
          <Input
            type="date"
            defaultValue={current.from ?? ""}
            className="h-8 w-36"
            onChange={(event) => {
              apply({ from: event.target.value });
            }}
          />
        </Field>
      ) : null}

      {filters.includes("to") ? (
        <Field label="To">
          <Input
            type="date"
            defaultValue={current.to ?? ""}
            className="h-8 w-36"
            onChange={(event) => {
              apply({ to: event.target.value });
            }}
          />
        </Field>
      ) : null}

      {filters.includes("q") ? (
        <Field label="Search">
          <Input
            defaultValue={current.q ?? ""}
            placeholder="Name or code"
            className="h-8 w-48"
            onKeyDown={(event) => {
              if (event.key === "Enter") apply({ q: event.currentTarget.value });
            }}
            onBlur={(event) => {
              apply({ q: event.target.value });
            }}
          />
        </Field>
      ) : null}

      {hasAny ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              router.push(`/reports/${reportId}`);
            });
          }}
        >
          <X />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}
