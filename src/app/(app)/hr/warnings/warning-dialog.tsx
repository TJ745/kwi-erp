"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { WARNING_LEVELS } from "@/lib/schemas/hr-records";
import { matchReason, OTHER_REASON, WARNING_REASONS } from "@/lib/warning-letter";
import { createWarningAction, updateWarningAction } from "@/server/actions/hr-records";

export type WarningValues = {
  id: string;
  employeeId: string;
  level: string;
  reason: string;
  description: string;
  descriptionAr: string;
  project: string | null;
  issuedDate: string;
};

const TEXTAREA =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/** The reason a saved warning starts from: its preset if the wording still matches. */
function initialReasonKey(warning: WarningValues | undefined): string {
  if (!warning) return WARNING_REASONS[0]?.key ?? OTHER_REASON;
  return matchReason(warning.reason, warning.description)?.key ?? OTHER_REASON;
}

export function WarningDialog({
  employees,
  warning,
  open: controlledOpen,
  onOpenChange,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  warning?: WarningValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const [reasonKey, setReasonKey] = React.useState(() => initialReasonKey(warning));
  const [customReason, setCustomReason] = React.useState(() =>
    warning && initialReasonKey(warning) === OTHER_REASON ? warning.reason : "",
  );
  const [textEn, setTextEn] = React.useState(
    () => warning?.description ?? WARNING_REASONS[0]?.en ?? "",
  );
  const [textAr, setTextAr] = React.useState(
    () => warning?.descriptionAr ?? WARNING_REASONS[0]?.ar ?? "",
  );

  function reset() {
    const key = initialReasonKey(warning);
    setReasonKey(key);
    setCustomReason(warning && key === OTHER_REASON ? warning.reason : "");
    setTextEn(warning?.description ?? WARNING_REASONS[0]?.en ?? "");
    setTextAr(warning?.descriptionAr ?? WARNING_REASONS[0]?.ar ?? "");
  }

  const setOpen = (next: boolean) => {
    // Each opening starts from the saved letter, not from abandoned edits.
    if (next) reset();
    if (isControlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };

  function pickReason(key: string) {
    setReasonKey(key);
    const preset = WARNING_REASONS.find((r) => r.key === key);
    if (preset) {
      setTextEn(preset.en);
      setTextAr(preset.ar);
    } else {
      // "Other": the sentence is written by hand, in both languages.
      setTextEn("");
      setTextAr("");
    }
  }

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const preset = WARNING_REASONS.find((r) => r.key === reasonKey);

    const values = {
      employeeId: readString(fd, "employeeId"),
      level: readString(fd, "level"),
      reason: preset ? preset.label : customReason,
      description: textEn,
      descriptionAr: textAr,
      project: readString(fd, "project"),
      issuedDate: readString(fd, "issuedDate"),
    };

    startTransition(async () => {
      const result = warning
        ? await updateWarningAction({ ...values, id: warning.id })
        : await createWarningAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(warning ? "Warning updated." : "Warning issued.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {!isControlled ? (
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          Issue warning
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{warning ? "Edit warning" : "Issue warning"}</DialogTitle>
              <DialogDescription>
                Prints as the bilingual warning letter. The employee&apos;s name, ID, position and
                company come from their record. Pick a reason and both languages fill in.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  name="employeeId"
                  label="Employee"
                  required
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.fullName} · ${e.employeeNo}`,
                  }))}
                  defaultValue={warning?.employeeId ?? ""}
                  errors={errors.employeeId}
                />
                <DateField
                  name="issuedDate"
                  label="Letter date"
                  required
                  defaultValue={warning?.issuedDate ?? new Date().toISOString().slice(0, 10)}
                  errors={errors.issuedDate}
                />
                <SelectField
                  name="level"
                  label="Level"
                  hint="For your records — not printed."
                  required
                  options={WARNING_LEVELS.map((l) => ({
                    value: l,
                    label: l.replace(/_/g, " "),
                  }))}
                  defaultValue={warning?.level ?? "FIRST_WRITTEN"}
                  errors={errors.level}
                />
                <TextField
                  name="project"
                  label="Project / site"
                  hint="Optional. Printed in brackets, e.g. (Al-Yamama Project)."
                  defaultValue={warning?.project ?? ""}
                  errors={errors.project}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warning-reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <select
                  id="warning-reason"
                  value={reasonKey}
                  onChange={(e) => {
                    pickReason(e.target.value);
                  }}
                  className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {WARNING_REASONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                  <option value={OTHER_REASON}>Other (type it yourself)</option>
                </select>
              </div>

              {reasonKey === OTHER_REASON ? (
                <div className="space-y-2">
                  <Label htmlFor="warning-custom-reason">
                    Short reason <span className="text-destructive">*</span>
                  </Label>
                  <input
                    id="warning-custom-reason"
                    value={customReason}
                    onChange={(e) => {
                      setCustomReason(e.target.value);
                    }}
                    placeholder="Shown in the warnings list, e.g. Sleeping during working hours"
                    aria-invalid={Boolean(errors.reason)}
                    className={TEXTAREA}
                  />
                  {errors.reason ? (
                    <p className="text-destructive text-xs">{errors.reason[0]}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="warning-text-en">
                    What happened — English <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="warning-text-en"
                    rows={6}
                    value={textEn}
                    onChange={(e) => {
                      setTextEn(e.target.value);
                    }}
                    placeholder="It has come to our attention that you…"
                    aria-invalid={Boolean(errors.description)}
                    className={TEXTAREA}
                  />
                  {errors.description ? (
                    <p className="text-destructive text-xs">{errors.description[0]}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warning-text-ar">
                    What happened — Arabic <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="warning-text-ar"
                    dir="rtl"
                    lang="ar"
                    rows={6}
                    value={textAr}
                    onChange={(e) => {
                      setTextAr(e.target.value);
                    }}
                    placeholder="لقد علمنا أنك…"
                    aria-invalid={Boolean(errors.descriptionAr)}
                    className={TEXTAREA}
                  />
                  {errors.descriptionAr ? (
                    <p className="text-destructive text-xs">{errors.descriptionAr[0]}</p>
                  ) : null}
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                The rest of the letter — the opening line, the formal warning paragraph,
                &quot;Regards, HR&quot; and the signature line — is fixed text in both languages.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : warning ? "Save changes" : "Issue warning"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
