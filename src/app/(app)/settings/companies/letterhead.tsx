"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUploadThing } from "@/lib/uploadthing";
import { extensionOf } from "@/lib/file-validation";
import { setCompanyBrandingAction } from "@/server/actions/org";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

type Slot = "HEADER" | "FOOTER";

/**
 * Letterhead artwork for one company.
 *
 * Two steps, same as document upload: bytes to storage first, then the file id
 * is attached to the company. The server verifies magic bytes before returning
 * an id and re-checks that the id is an image before accepting it, so nothing
 * here is load-bearing — this only stops the obvious mistakes early.
 */
export function Letterhead({
  companyId,
  companyCode,
  hasHeader,
  hasFooter,
}: {
  companyId: string;
  companyCode: string;
  hasHeader: boolean;
  hasFooter: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ImageUp />
          Letterhead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Letterhead for {companyCode}</DialogTitle>
          <DialogDescription>
            These images print at the top and bottom of every letter and certificate
            generated for this company. PNG, JPEG, or WebP, up to 8&nbsp;MB. A wide,
            short image works best — roughly 1600&nbsp;&times;&nbsp;300 for the header.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <SlotEditor
            companyId={companyId}
            slot="HEADER"
            label="Header image"
            present={hasHeader}
          />
          <SlotEditor
            companyId={companyId}
            slot="FOOTER"
            label="Footer image"
            present={hasFooter}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SlotEditor({
  companyId,
  slot,
  label,
  present,
}: {
  companyId: string;
  slot: Slot;
  label: string;
  present: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [saving, startSaving] = React.useTransition();
  // Bumped after every change so the browser re-fetches the preview rather
  // than showing the image that was just replaced.
  const [version, setVersion] = React.useState(0);

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    onClientUploadComplete: (result) => {
      const fileId = result[0]?.serverData.fileId;
      if (!fileId) {
        toast.error("The upload finished but no file was returned.");
        return;
      }
      attach(fileId);
    },
    onUploadError: (error) => {
      toast.error(error.message);
    },
  });

  function attach(fileId: string | null) {
    startSaving(async () => {
      const result = await setCompanyBrandingAction({ companyId, slot, fileId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(fileId === null ? `${label} removed.` : `${label} updated.`);
      setVersion((v) => v + 1);
      router.refresh();
    });
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!IMAGE_EXTENSIONS.includes(extensionOf(file.name))) {
      toast.error("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is larger than 8 MB.");
      return;
    }

    void startUpload([file], { entityType: "COMPANY", entityId: companyId });
  }

  const busy = isUploading || saving;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {present ? "Replace" : "Upload"}
          </Button>
          {present ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                attach(null);
              }}
            >
              <Trash2 />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={onPick}
      />

      <div className="bg-muted/40 flex min-h-20 items-center justify-center rounded-md border p-2">
        {present ? (
          // The bytes stream through a session-gated route, not a public URL,
          // so next/image's optimiser cannot fetch it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/companies/${companyId}/branding/${slot.toLowerCase()}?v=${String(version)}`}
            alt={`${label} preview`}
            className="max-h-24 w-auto max-w-full object-contain"
          />
        ) : (
          <p className="text-muted-foreground text-xs">Not set</p>
        )}
      </div>
    </div>
  );
}
