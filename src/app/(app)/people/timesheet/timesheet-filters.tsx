"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

/** Company and year filters, kept in the URL so a filtered list can be shared or printed. */
export function TimesheetFilters({
  companies,
  years,
}: {
  companies: { id: string; code: string }[];
  years: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={params.get("company") ?? ALL} onValueChange={(v) => set("company", v)}>
        <SelectTrigger className="w-44" aria-label="Company">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All companies</SelectItem>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("year") ?? ALL} onValueChange={(v) => set("year", v)}>
        <SelectTrigger className="w-32" aria-label="Year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All years</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
