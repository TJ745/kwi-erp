"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Print list" for any list page.
 *
 * Paginated lists only hold one page of rows, so clicking first reloads the
 * page with `?print=1` — which `parseListQuery` (and the audit log) turn into
 * "every row matching the current filters" — and only then opens the print
 * dialog. Search and filters carry over, so what prints is what the user was
 * looking at, minus the page boundary.
 *
 * While printing, `data-print-list` on <html> switches on the list print
 * styles in globals.css (controls hidden, tables unclipped), and dark mode is
 * lifted so the paper copy is always black on white.
 */
export function PrintListButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const printing = searchParams.get("print") === "1";

  const urlWith = React.useCallback(
    (print: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (print) {
        params.set("print", "1");
        params.delete("page");
      } else {
        params.delete("print");
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  React.useEffect(() => {
    if (!printing) return;

    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");

    const restore = () => {
      delete html.dataset.printList;
      if (wasDark) html.classList.add("dark");
      // Back to the normal, paginated view once the dialog closes.
      router.replace(urlWith(false), { scroll: false });
    };

    html.dataset.printList = "1";
    html.classList.remove("dark");
    window.addEventListener("afterprint", restore, { once: true });

    // One frame so the full list has painted before the dialog snapshots it.
    const frame = requestAnimationFrame(() => {
      window.print();
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", restore);
    };
  }, [printing, router, urlWith]);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={printing}
      onClick={() => {
        // A new tab, like every other print: the list being worked on stays put.
        window.open(urlWith(true), "_blank", "noopener");
      }}
    >
      <Printer />
      {printing ? "Preparing…" : "Print list"}
    </Button>
  );
}
