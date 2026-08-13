"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ANY = "__any";

/** Period and employee live in the URL, so a filtered view is shareable. */
export function TimesheetFilters({
  employees,
  current,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  current: { employeeId: string; from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ANY) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Employee</Label>
        <Select
          value={current.employeeId || ANY}
          onValueChange={(value) => {
            apply({ employeeId: value });
          }}
          disabled={pending}
        >
          <SelectTrigger size="sm" className="w-64">
            <SelectValue placeholder="Everyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Everyone</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.fullName} · {e.employeeNo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">From</Label>
        <Input
          type="date"
          defaultValue={current.from}
          className="h-8 w-36"
          onChange={(e) => {
            apply({ from: e.target.value });
          }}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">To</Label>
        <Input
          type="date"
          defaultValue={current.to}
          className="h-8 w-36"
          onChange={(e) => {
            apply({ to: e.target.value });
          }}
        />
      </div>

      <p className="text-muted-foreground pb-1 text-xs">
        Period approval needs a single employee selected.
      </p>
    </div>
  );
}
