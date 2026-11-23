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
import { Label } from "@/components/ui/label";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { useUploadThing } from "@/lib/uploadthing";
import { extensionOf, maxBytesFor } from "@/lib/file-validation";
import { TIMESHEET_EXTENSIONS } from "@/lib/schemas/timesheet";
import { createTimesheetFileAction } from "@/server/actions/timesheets";

/** Last month, as `YYYY-MM`: timesheets are usually filed after the month ends. */
function defaultMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Two steps, like every upload in the app: the file goes to storage and is
 * verified first, then the company + month record is saved against it.
 */
export function UploadTimesheet({
  companies,
  taken,
}: {
  companies: { id: string; code: string; name: string }[];
  /** `companyId:YYYY-MM` pairs that already have a file. */
  taken: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [companyId, setCompanyId] = React.useState(companies[0]?.id ?? "");
  const [month, setMonth] = React.useState(defaultMonth);
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileId, setFileId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [saving, startSaving] = React.useTransition();
  const companyCode = companies.find((c) => c.id === companyId)?.code ?? "";
  const alreadyUploaded = taken.includes(`${companyId}:${month}`);

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    onClientUploadComplete: (result) => {
      const id = result[0]?.serverData?.fileId;
      if (id) {
        setFileId(id);
      } else {
        toast.error("The file uploaded but was not registered. Please try again.");
        setFile(null);
      }
    },
    onUploadError: (error) => {
      toast.error(error.message);
      setFile(null);
    },
  });

  function reset() {
    setFile(null);
    setFileId(null);
    setNotes("");
    setErrors({});
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const ext = extensionOf(selected.name);
    if (!(TIMESHEET_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error("Choose an Excel file (.xlsx or .xls) or a PDF.");
      event.target.value = "";
      return;
    }
    if (selected.size > maxBytesFor(ext)) {
      toast.error(`That file is larger than ${String(Math.round(maxBytesFor(ext) / 1048576))} MB.`);
      event.target.value = "";
      return;
    }
    setFile(selected);
    setFileId(null);
    // The upload is checked against the company it is filed under.
    void startUpload([selected], { entityType: "COMPANY", entityId: companyId });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fileId) return;
    setErrors({});
    startSaving(async () => {
      const result = await createTimesheetFileAction({ companyId, month, fileId, notes });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success("Timesheet uploaded.");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload />
        Upload timesheet
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload timesheet</DialogTitle>
            <DialogDescription>
              One file per company per month — Excel (.xlsx, .xls) or PDF.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <SelectField
              name="companyId"
              label="Company"
              required
              defaultValue={companyId}
              options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              onChange={(v) => {
                setCompanyId(v);
                // A file uploaded under another company is re-uploaded under this one.
                if (file) reset();
              }}
              errors={errors.companyId}
            />
            <TextField
              name="month"
              label="Month"
              type="month"
              required
              defaultValue={month}
              onChange={(v) => {
                setMonth(v);
                if (file) reset();
              }}
              errors={errors.month}
            />

            <div className="space-y-2">
              <Label htmlFor="timesheet-file">
                File <span className="text-destructive">*</span>
              </Label>
              <input
                id="timesheet-file"
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={onFileChange}
                disabled={isUploading || !companyId || !month || alreadyUploaded}
                className="file:bg-muted block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5"
              />
              {alreadyUploaded ? (
                <p className="text-status-warning text-xs">
                  {companyCode} already has a timesheet for this month. Delete it from the list
                  first to upload a replacement.
                </p>
              ) : isUploading ? (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="size-3 animate-spin" /> Uploading and checking the file…
                </p>
              ) : fileId && file ? (
                <p className="text-status-valid text-xs">{file.name} — ready to save.</p>
              ) : null}
              {errors.fileId ? (
                <p className="text-destructive text-xs">{errors.fileId[0]}</p>
              ) : null}
            </div>

            <TextAreaField
              name="notes"
              label="Notes"
              rows={2}
              defaultValue={notes}
              onChange={setNotes}
              errors={errors.notes}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!fileId || isUploading || saving || alreadyUploaded}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
