import Link from "next/link";
import { Paperclip } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadEntityType } from "@/lib/upload-entities";

/**
 * Row-level link to a record's document library.
 *
 * Icon-only by default because it sits in a table cell next to the edit and
 * delete controls, where a worded button would crowd the row on a phone. The
 * accessible name still says which record it belongs to, since "Documents"
 * repeated forty times down a column tells a screen-reader user nothing.
 */
export function DocumentsLink({
  entityType,
  entityId,
  label,
  withText = false,
}: {
  entityType: UploadEntityType;
  entityId: string;
  /** Names the record, for the accessible label. */
  label: string;
  withText?: boolean;
}) {
  return (
    <Link
      href={`/documents/${entityType}/${entityId}`}
      aria-label={`Documents for ${label}`}
      className={cn(
        buttonVariants({ variant: "ghost", size: withText ? "sm" : "icon-sm" }),
        withText && "gap-1",
      )}
    >
      <Paperclip />
      {withText ? "Documents" : null}
    </Link>
  );
}
