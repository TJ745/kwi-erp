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

/**
 * ⌘K navigation. On mobile this is the primary way to move around, since the
 * sidebar collapses into a sheet (docs/MODULES.md §6).
 *
 * Global entity search (employees, assets, vehicles…) is added in Phase 5 once
 * there are records to search.
 */
export function CommandMenu({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = React.useState(false);
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

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command menu"
      description="Jump to a section"
    >
      <CommandInput placeholder="Search sections…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
