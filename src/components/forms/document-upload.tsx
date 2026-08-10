"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField, SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { useUploadThing } from "@/lib/uploadthing";
import { extensionOf, isAllowedExtension, maxBytesFor } from "@/lib/file-validation";
import { createDocumentAction } from "@/server/actions/documents";

type DocumentType = {
  id: string;
  name: string;
  requiresExpiry: boolean;
};

/**
 * Two-step upload: the bytes go to storage first, then the metadata is saved.
 *
 * The server verifies the file's magic bytes before it returns a fileId, so by
 * the time this form submits, the upload is already known to be a genuine
 * document of the claimed type (ADR-008).
 */
export function DocumentUpload({
  entityType,
  entityId,
  companyId,
  documentTypes,
  defaultTitle,
}: {
  entityType: "EMPLOYEE" | "COMPANY" | "VEHICLE" | "IT_ASSET";
  entityId: string;
  companyId: string;
  documentTypes: DocumentType[];
  defaultTitle?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [saving, startSaving] = React.useTransition();

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    onClientUploadComplete: (result) => {
      const first = result[0];
      if (first?.serverData.fileId) {
        setUploadedFileId(first.serverData.fileId);
        toast.success("File uploaded and verified.");
      }
    },
    onUploadError: (error) => {
      // The server's rejection reason is surfaced verbatim — it is written to
      // be user-facing ("file content does not match its type").
      toast.error(error.message);
      setFile(null);
    },
  });

  function reset() {
    setFile(null);
    setUploadedFileId(null);
    setErrors({});
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    // Client-side pre-check for a fast, friendly message. The server repeats
    // every one of these — this is UX, not security.
    const ext = extensionOf(selected.name);
    if (!isAllowedExtension(ext)) {
      toast.error(`Files of type ".${ext || "unknown"}" are not accepted.`);
      event.target.value = "";
      return;
    }
    if (selected.size > maxBytesFor(ext)) {
      toast.error(`That file is larger than ${String(Math.round(maxBytesFor(ext) / 1048576))} MB.`);
      event.target.value = "";
      return;
    }

    setFile(selected);
    setUploadedFileId(null);
    void startUpload([selected], { entityType, entityId });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadedFileId) return;
    setErrors({});

    const fd = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await createDocumentAction({
        fileId: uploadedFileId,
        documentTypeId: readString(fd, "documentTypeId"),
        entityType,
        entityId,
        companyId,
        title: readString(fd, "title"),
        documentNo: readString(fd, "documentNo"),
        issueDate: readString(fd, "issueDate"),
        expiryDate: readString(fd, "expiryDate"),
        issuedBy: readString(fd, "issuedBy"),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success("Document saved.");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Upload />
        Upload document
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              PDF, image, Word, or Excel. Files are stored privately and verified on upload.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="document-file" className="text-sm font-medium">
              File <span className="text-destructive">*</span>
            </label>
            <input
              id="document-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={onFileChange}
              disabled={isUploading || saving}
              className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
            {isUploading ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3 animate-spin" />
                Uploading and verifying…
              </p>
            ) : uploadedFileId ? (
              <p className="text-status-valid text-xs">Verified: {file?.name}</p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <fieldset disabled={!uploadedFileId || saving} className="space-y-4">
              <TextField
                name="title"
                label="Title"
                required
                defaultValue={defaultTitle ?? ""}
                errors={errors.title}
              />
              <SelectField
                name="documentTypeId"
                label="Document type"
                required
                options={documentTypes.map((t) => ({
                  value: t.id,
                  label: t.requiresExpiry ? `${t.name} (expiry required)` : t.name,
                }))}
                errors={errors.documentTypeId}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField name="issueDate" label="Issue date" errors={errors.issueDate} />
                <DateField name="expiryDate" label="Expiry date" errors={errors.expiryDate} />
              </div>
              <TextField
                name="documentNo"
                label="Document number"
                errors={errors.documentNo}
              />
              <TextField name="issuedBy" label="Issued by" errors={errors.issuedBy} />
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!uploadedFileId || saving}>
                {saving ? "Saving…" : "Save document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
