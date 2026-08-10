"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import { EmptyState } from "@/components/shared/states";
import { deleteDocumentAction } from "@/server/actions/documents";

export type DocumentRow = {
  id: string;
  title: string;
  documentNo: string | null;
  typeName: string;
  issueDate: string | null;
  expiryDate: string | null;
  fileId: string;
  originalName: string;
  sizeBytes: number;
  version: number;
};

export function DocumentList({
  documents,
  canDelete,
}: {
  documents: DocumentRow[];
  canDelete: boolean;
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Upload a CV, Iqama copy, passport scan, or contract. Documents with an expiry date appear automatically in the dashboard alerts."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Employee documents</caption>
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Document</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Issued</th>
            <th className="px-4 py-2 font-medium">Expires</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-t">
              <td className="px-4 py-2">
                <p className="font-medium">{doc.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {doc.originalName}
                  {doc.version > 1 ? ` · v${String(doc.version)}` : ""}
                </p>
              </td>
              <td className="text-muted-foreground px-4 py-2 text-xs">{doc.typeName}</td>
              <td className="px-4 py-2 tabular-nums">{doc.issueDate ?? "—"}</td>
              <td className="px-4 py-2">
                {doc.expiryDate ? (
                  <ExpiryDate date={doc.expiryDate} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="text-muted-foreground px-4 py-2 text-xs tabular-nums">
                {formatSize(doc.sizeBytes)}
              </td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-1">
                  {/* Downloads route through the authorised proxy, never a
                      storage URL — see docs/SECURITY.md §6.4. */}
                  <a
                    href={`/api/files/${doc.fileId}`}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    aria-label={`Download ${doc.title}`}
                  >
                    <Download />
                  </a>
                  {canDelete ? <DeleteButton doc={doc} /> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeleteButton({ doc }: { doc: DocumentRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${doc.title}`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              “{doc.title}” will be removed and the stored file destroyed. The audit trail keeps
              a record that it existed and who deleted it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteDocumentAction({ id: doc.id });
                  if (result.success) {
                    toast.success("Document deleted.");
                    setOpen(false);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
