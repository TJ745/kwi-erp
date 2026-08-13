"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FieldChange = { before?: unknown; after?: unknown };

/**
 * Field-level detail for one audit entry.
 *
 * The values here were redacted at WRITE time by server/audit/redact.ts — a
 * field in REDACTED_FIELDS is stored as the placeholder, never as its value.
 * This component therefore has nothing to hide and does no filtering of its
 * own; adding filtering here would imply the stored data needs it, which would
 * be the more serious problem.
 */
export function AuditChanges({
  summary,
  changes,
}: {
  summary: string;
  changes: unknown;
}) {
  const [open, setOpen] = React.useState(false);

  const entries = React.useMemo<[string, FieldChange][]>(() => {
    if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
      return [];
    }
    return Object.entries(changes as Record<string, FieldChange>);
  }, [changes]);

  if (entries.length === 0) {
    return <span className="text-muted-foreground/50 text-xs">—</span>;
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="View changed fields"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Eye className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changed fields</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Field</th>
                  <th className="px-3 py-2 text-left font-medium">Before</th>
                  <th className="px-3 py-2 text-left font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([field, change]) => (
                  <tr key={field} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{field}</td>
                    <td className="text-muted-foreground px-3 py-2 font-mono text-xs break-all">
                      {format(change.before)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs break-all">
                      {format(change.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function format(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
