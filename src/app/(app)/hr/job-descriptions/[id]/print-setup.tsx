"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * While this page is open: "Page X of Y" in the bottom-right page margin, as
 * on the company template. Added as a page-level style so letters and other
 * documents keep their own page setup.
 */
export function PageNumbers() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-print-page-numbers", "");
    style.textContent = `@page { size: A4; margin: 0.6in 0.7in 0.6in 0.7in;
      @bottom-right { content: "Page " counter(page) " of " counter(pages);
        font-family: Cambria, "Times New Roman", serif; font-size: 10px; color: #000; } }`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
  return null;
}

/** Fills the acknowledgement lines with one employee, or leaves them blank. */
export function EmployeePicker({
  employees,
  selected,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground whitespace-nowrap">Print for employee</span>
      <select
        aria-label="Print for employee"
        className="border-input h-8 max-w-72 rounded-md border bg-transparent px-2 text-sm"
        value={selected ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set("employee", e.target.value);
          else next.delete("employee");
          const qs = next.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        }}
      >
        <option value="">— Blank (fill by hand) —</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.fullName} · {e.employeeNo}
          </option>
        ))}
      </select>
    </label>
  );
}
