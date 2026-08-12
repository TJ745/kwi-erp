"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Plain links, not fetches: the browser handles the download, the file never
 * passes through JavaScript, and the response's Content-Disposition does the
 * work. The query string is the page's own, so the file matches what is on
 * screen.
 */
export function ExportButtons({ reportId, query }: { reportId: string; query: string }) {
  const base = `/api/reports/${reportId}/export`;
  const suffix = query ? `&${query}` : "";

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={`${base}?format=csv${suffix}`} download>
          <Download />
          CSV
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={`${base}?format=xlsx${suffix}`} download>
          <Download />
          Excel
        </a>
      </Button>
    </div>
  );
}
