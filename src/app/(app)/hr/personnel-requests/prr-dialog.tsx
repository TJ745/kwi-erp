"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import { DateField, SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { ChoiceGroup } from "@/components/forms/choice-group";
import { readString } from "@/lib/form-data";
import {
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  EXTERNAL_LABELS,
  EXTERNAL_SOURCES,
  LANGUAGE_LABELS,
  LANGUAGES,
} from "@/lib/recruitment-forms";
import type { PrrDetails } from "@/lib/schemas/recruitment";
import { createPrrAction, updatePrrAction } from "@/server/actions/recruitment";

export type PrrValues = {
  id: string;
  companyId: string;
  prrNo: string;
  requestDate: string;
  positionId: string | null;
  departmentId: string | null;
  jobTitle: string;
  vacancies: number;
  details: PrrDetails;
};

type Options = {
  companies: { id: string; code: string; name: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  departments: { id: string; name: string; companyId: string }[];
  /** Approved budget and current headcount per position. */
  manpower: Record<string, { budget: number; headcount: number }>;
};

const today = () => new Date().toISOString().slice(0, 10);
const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((v) => ({ value: v, label: labels[v] }));

/** Personnel Requirement Request (FM:AP:002). One request per vacancy. */
export function PrrDialog({ prr, ...o }: Options & { prr?: PrrValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState(prr?.companyId ?? o.companies[0]?.id ?? "");
  const [positionId, setPositionId] = React.useState(prr?.positionId ?? "");

  const company = o.companies.find((c) => c.id === companyId);
  const position = o.positions.find((p) => p.id === positionId);
  const d = prr?.details;
  // A newly picked position brings its title and manpower figures.
  const fromPosition = !prr || positionId !== (prr.positionId ?? "");
  const mp = positionId ? o.manpower[positionId] : undefined;
  const budget = mp && mp.budget > 0 ? String(mp.budget) : "";
  const headcount = mp ? String(mp.headcount) : "";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCompanyId(prr?.companyId ?? o.companies[0]?.id ?? "");
      setPositionId(prr?.positionId ?? "");
      setErrors({});
      setFormError(null);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);
    const s = (k: string) => readString(fd, k);
    const payload = {
      companyId,
      prrNo: s("prrNo"),
      requestDate: s("requestDate"),
      positionId,
      departmentId: s("departmentId"),
      jobTitle: s("jobTitle"),
      vacancies: s("vacancies") || "1",
      details: {
        section: s("section"),
        divisionDepartment: s("divisionDepartment"),
        dateNeeded: s("dateNeeded"),
        purpose: s("purpose"),
        replacementOf: s("replacementOf"),
        hrRemarks: s("hrRemarks"),
        educationRequired: fd.getAll("educationRequired").map(String),
        educationPreferable: fd.getAll("educationPreferable").map(String),
        specialization: s("specialization"),
        experienceFields: s("experienceFields"),
        yearsMin: s("yearsMin"),
        yearsMax: s("yearsMax"),
        skills: s("skills"),
        language: s("language"),
        sourcing: s("sourcing"),
        externalSource: s("externalSource"),
        justification: s("justification"),
        manpowerBudget: s("manpowerBudget"),
        manpowerHeadcount: s("manpowerHeadcount"),
        manpowerProjected: s("manpowerProjected"),
        manpowerRequested: s("manpowerRequested"),
        manpowerRemarks: s("manpowerRemarks"),
      },
    };
    startTransition(async () => {
      const result = prr
        ? await updatePrrAction({ ...payload, id: prr.id })
        : await createPrrAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? "Please check the highlighted fields." : result.error);
        return;
      }
      toast.success(prr ? "Request updated." : "Request created.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {prr ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Edit"
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button
          onClick={() => {
            onOpenChange(true);
          }}
        >
          <Plus />
          New request
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {prr ? `Edit ${prr.prrNo}` : "New personnel requirement request"}
            </DialogTitle>
            <DialogDescription>
              One request per vacancy. Picking a position fills in its title and the manpower
              inventory (budget and current headcount).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">For HR</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  name="companyPick"
                  label="Company"
                  required
                  defaultValue={companyId}
                  options={o.companies.map((c) => ({ value: c.id, label: c.code }))}
                  onChange={(v) => {
                    setCompanyId(v);
                    setPositionId("");
                  }}
                  errors={errors.companyId}
                />
                <DateField
                  name="requestDate"
                  label="Date received"
                  required
                  defaultValue={prr?.requestDate ?? today()}
                  errors={errors.requestDate}
                />
                <TextField
                  name="prrNo"
                  label="PRR No."
                  hint={prr ? undefined : "Blank numbers it automatically."}
                  defaultValue={prr?.prrNo ?? ""}
                  errors={errors.prrNo}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-4" key={companyId}>
              <legend className="text-sm font-semibold">I. Personnel requisitioned</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  name="positionPick"
                  label="Position"
                  placeholder="None"
                  defaultValue={positionId}
                  options={o.positions
                    .filter((p) => p.companyId === null || p.companyId === companyId)
                    .map((p) => ({ value: p.id, label: p.title }))}
                  onChange={setPositionId}
                />
                <TextField
                  key={`title-${positionId}`}
                  name="jobTitle"
                  label="Job title"
                  required
                  defaultValue={
                    fromPosition ? (position?.title ?? prr?.jobTitle ?? "") : (prr?.jobTitle ?? "")
                  }
                  errors={errors.jobTitle}
                />
                <TextField
                  name="vacancies"
                  label="No. of vacancies"
                  type="number"
                  defaultValue={String(prr?.vacancies ?? 1)}
                  errors={errors.vacancies}
                />
                <TextField
                  name="dateNeeded"
                  label="Date needed (in months)"
                  defaultValue={d?.dateNeeded ?? ""}
                />
                <TextField
                  name="section"
                  label="Section"
                  defaultValue={d?.section ?? company?.code ?? ""}
                />
                <SelectField
                  name="departmentId"
                  label="Department"
                  placeholder="None"
                  defaultValue={prr?.departmentId ?? ""}
                  options={o.departments
                    .filter((x) => x.companyId === companyId)
                    .map((x) => ({ value: x.id, label: x.name }))}
                />
                <TextField
                  name="divisionDepartment"
                  label="Division / Department (as printed)"
                  hint="e.g. KWI/Sales"
                  defaultValue={d?.divisionDepartment ?? ""}
                  className="sm:col-span-2"
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">II. Purpose of requisition</legend>
              <ChoiceGroup
                name="purpose"
                label="Purpose"
                defaultValue={d?.purpose ?? ""}
                options={[
                  { value: "NEW", label: "New Position" },
                  { value: "ADDITIONAL", label: "Additional Employee" },
                  { value: "REPLACEMENT", label: "Replacement" },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="replacementOf"
                  label="Replacement of"
                  defaultValue={d?.replacementOf ?? ""}
                />
                <TextField
                  name="hrRemarks"
                  label="Remarks (for HR use only)"
                  defaultValue={d?.hrRemarks ?? ""}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">III. Basic qualifications</legend>
              <ChoiceGroup
                name="educationRequired"
                label="Education — required"
                multiple
                defaultValue={d?.educationRequired ?? []}
                options={opts(EDUCATION_LEVELS, EDUCATION_LABELS)}
              />
              <ChoiceGroup
                name="educationPreferable"
                label="Education — preferable"
                multiple
                defaultValue={d?.educationPreferable ?? []}
                options={opts(EDUCATION_LEVELS, EDUCATION_LABELS)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="specialization"
                  label="Specialization"
                  defaultValue={d?.specialization ?? ""}
                  className="sm:col-span-2"
                />
                <TextField
                  name="experienceFields"
                  label="Experience — fields"
                  defaultValue={d?.experienceFields ?? ""}
                  className="sm:col-span-2"
                />
                <TextField
                  name="yearsMin"
                  label="Years — minimum"
                  placeholder="5 Years"
                  defaultValue={d?.yearsMin ?? ""}
                />
                <TextField
                  name="yearsMax"
                  label="Years — maximum"
                  placeholder="8 Years"
                  defaultValue={d?.yearsMax ?? ""}
                />
                <TextField
                  name="skills"
                  label="Skills"
                  defaultValue={d?.skills ?? ""}
                  className="sm:col-span-2"
                />
              </div>
              <ChoiceGroup
                name="language"
                label="Language"
                defaultValue={d?.language ?? ""}
                options={opts(LANGUAGES, LANGUAGE_LABELS)}
              />
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">IV. Sourcing method</legend>
              <ChoiceGroup
                name="sourcing"
                label="Internal or external"
                defaultValue={d?.sourcing ?? ""}
                options={[
                  { value: "INTERNAL", label: "Internal" },
                  { value: "EXTERNAL", label: "External" },
                ]}
              />
              <ChoiceGroup
                name="externalSource"
                label="If external"
                defaultValue={d?.externalSource ?? ""}
                options={opts(EXTERNAL_SOURCES, EXTERNAL_LABELS)}
              />
            </fieldset>

            <TextAreaField
              name="justification"
              label="V. Justification"
              defaultValue={d?.justification ?? ""}
            />

            <fieldset className="space-y-3" key={`mp-${positionId}`}>
              <legend className="text-sm font-semibold">
                VI. Manpower inventory (for HR use only)
              </legend>
              <div className="grid gap-4 sm:grid-cols-5">
                <TextField
                  name="manpowerBudget"
                  label="Budget (A)"
                  defaultValue={fromPosition ? budget : (d?.manpowerBudget ?? "")}
                />
                <TextField
                  name="manpowerHeadcount"
                  label="Headcount (B)"
                  defaultValue={fromPosition ? headcount : (d?.manpowerHeadcount ?? "")}
                />
                <TextField
                  name="manpowerProjected"
                  label="A – B"
                  defaultValue={
                    fromPosition
                      ? budget && headcount
                        ? String(Number(budget) - Number(headcount))
                        : ""
                      : (d?.manpowerProjected ?? "")
                  }
                />
                <TextField
                  name="manpowerRequested"
                  label="Requested (C)"
                  defaultValue={d?.manpowerRequested ?? ""}
                />
                <TextField
                  name="manpowerRemarks"
                  label="Remarks (X / Y)"
                  hint="X within, Y beyond budget"
                  defaultValue={d?.manpowerRemarks ?? ""}
                />
              </div>
            </fieldset>

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
                {pending ? "Saving…" : prr ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
