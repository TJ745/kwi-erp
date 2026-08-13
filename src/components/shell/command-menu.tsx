"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { NavSection } from "@/lib/navigation";
import type { SearchHit } from "@/server/services/search";
import { globalSearchAction } from "@/server/actions/search";

/**
 * ⌘K navigation and global entity search.
 *
 * Sections are filtered server-side before they reach this component, and
 * search results are permission-gated per source in the service — so anything
 * appearing here is something the actor can actually open.
 */
export function CommandMenu({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const trimmed = query.trim();
  const isSearch = trimmed.length >= 2;

  // Debounced, and every response checks it is still the newest one before
  // rendering — otherwise a slow query for "ah" can land after a fast one for
  // "ahmed" and replace the right results with stale ones.
  //
  // Nothing is set synchronously in the effect body: the short-query case is
  // handled by deriving `results` below rather than by clearing state, which
  // would be an extra render and a lint error besides.
  React.useEffect(() => {
    if (!isSearch) return;

    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void globalSearchAction({ query: trimmed }).then((result) => {
        if (!current) return;
        setHits(result.success ? result.data : []);
        setSearching(false);
      });
    }, 200);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [trimmed, isSearch]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  // Derived, not stored: below the minimum length there is nothing to show,
  // and stale hits from a longer previous query must not linger.
  const grouped = React.useMemo(() => {
    if (!isSearch) return [];
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      map.set(hit.group, [...(map.get(hit.group) ?? []), hit]);
    }
    return [...map.entries()];
  }, [hits, isSearch]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      title="Command menu"
      description="Jump to a section, or search employees, assets, vehicles and more"
      // cmdk filters items by their `value`; search results are already ranked
      // and filtered by the server, so its client-side filter is turned off.
      shouldFilter={!isSearch}
    >
      <CommandInput
        placeholder="Search sections, people, assets…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearch && searching ? "Searching…" : "No results found."}
        </CommandEmpty>

        {grouped.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((hit) => (
              <CommandItem
                key={`${hit.group}-${hit.id}`}
                value={`${hit.group}-${hit.id}`}
                onSelect={() => {
                  go(hit.href);
                }}
              >
                <span>{hit.title}</span>
                {hit.subtitle ? (
                  <span className="text-muted-foreground ml-auto truncate text-xs">
                    {hit.subtitle}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        {grouped.length > 0 ? <CommandSeparator /> : null}

        {sections.map((section, index) => (
          <React.Fragment key={section.label}>
            {index > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={section.label}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${section.label} ${item.label} ${item.keywords?.join(" ") ?? ""}`}
                  disabled={item.planned === true}
                  onSelect={() => {
                    if (!item.planned) go(item.href);
                  }}
                >
                  <span>{item.label}</span>
                  {item.planned ? (
                    <span className="text-muted-foreground ml-auto text-[10px] uppercase">
                      soon
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
