"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * URL-backed search box for list views.
 *
 * Debounced so typing does not fire a request per keystroke, and it writes to
 * the URL rather than local state so the result stays shareable and the server
 * remains the single source of truth for what is displayed.
 */
export function SearchInput({
  placeholder = "Search…",
  paramName = "q",
  debounceMs = 350,
}: {
  placeholder?: string;
  paramName?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = searchParams.get(paramName) ?? "";
  const [value, setValue] = React.useState(initial);

  // Adjust state during render when the URL changes from elsewhere (back
  // button, "clear filters"). This is React's sanctioned pattern for deriving
  // state from props — an effect here would cause a cascading re-render.
  const [lastUrlValue, setLastUrlValue] = React.useState(initial);
  if (initial !== lastUrlValue) {
    setLastUrlValue(initial);
    setValue(initial);
  }

  const commit = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set(paramName, next.trim());
      else params.delete(paramName);
      // Any new search returns to page 1; staying on page 7 of a new result
      // set is almost always an empty page.
      params.delete("page");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams, paramName],
  );

  React.useEffect(() => {
    if (value === initial) return;
    const timer = setTimeout(() => {
      commit(value);
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, initial, commit, debounceMs]);

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        className="pr-9 pl-9"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear search"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            setValue("");
            commit("");
          }}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
