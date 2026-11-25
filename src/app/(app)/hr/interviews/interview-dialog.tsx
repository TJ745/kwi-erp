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
  FINAL_ACTION_LABELS,
  FINAL_ACTIONS,
  PRELIMINARY_ROWS,
  RECOMMENDATION_LABELS,
  RECOMMENDATIONS,
  SECOND_ROWS,
  requiredFromPrr,
  type InterviewRow,
} from "@/lib/recruitment-forms";
import type { InterviewDetails } from "@/lib/schemas/recruitment";
import { createInterviewAction, updateInterviewAction } from "@/server/actions/recruitment";

export type InterviewValues = {
  id: string;
  companyId: string;
  prrId: string | null;
  employeeId: string | null;
  applicantName: string;
  positionTitle: string;
  interviewDate: string;
  details: InterviewDetails;
};

export type PrrOption = {
  id: string;
  prrNo: string;
  jobTitle: string;
  companyId: string;
  section: string;
  department: string;
  sourcing: string;
  externalSource: string;
  educationRequired: string[];
  specialization: string;
  experienceFields: string;
  yearsMin: string;
  language: string;
  skills: string;
};

/** An employee the interview can be for, with what fills in from their record. */
export type IntervieweeOption = {
  id: string;
  label: string;
  name: string;
  companyId: string;
  nationality: string;
  professionInIqama: string;
  position: string;
  department: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const recommendationOptions = RECOMMENDATIONS.map((r) => ({
  value: r,
  label: RECOMMENDATION_LABELS[r],
}));
const inputClass =
  "border-input bg-background h-8 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * Interview Evaluation Report (FM:AP:006). Picking the PRR fills the job,
 * section, department and the "Personnel Requirement Request" column.
 */
export function InterviewDialog({
  companies,
  prrs,
  employees = [],
  interview,
}: {
  companies: { id: string; code: string }[];
  prrs: PrrOption[];
  /** Picking one fills the applicant's details from their employee record. */
  employees?: IntervieweeOption[];
  /** Absent for create. */
  interview?: InterviewValues;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState(interview?.companyId ?? companies[0]?.id ?? "");
  const [prrId, setPrrId] = React.useState(interview?.prrId ?? "");
  const [employeeId, setEmployeeId] = React.useState(interview?.employeeId ?? "");
  // A newly picked employee fills in; otherwise the saved values stay.
  const who =
    employeeId !== (interview?.employeeId ?? "")
      ? employees.find((e) => e.id === employeeId)
      : undefined;

  const prr = prrs.find((p) => p.id === prrId);
  // Saved values while the PRR is unchanged; a newly picked PRR fills in.
  const saved = interview && prrId === (interview.prrId ?? "") ? interview : undefined;
  const d = saved?.details;
  const required = prr && !saved ? requiredFromPrr(prr) : {};

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCompanyId(interview?.companyId ?? companies[0]?.id ?? "");
      setPrrId(interview?.prrId ?? "");
      setEmployeeId(interview?.employeeId ?? "");
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
    const rows = Object.fromEntries(
      [...PRELIMINARY_ROWS, ...SECOND_ROWS].map((r) => [
        r.key,
        { required: s(`r_${r.key}_req`), actual: s(`r_${r.key}_act`), met: s(`r_${r.key}_met`) },
      ]),
    );
    const payload = {
      companyId,
      prrId,
      employeeId,
      applicantName: s("applicantName"),
      positionTitle: s("positionTitle"),
      interviewDate: s("interviewDate"),
      details: {
        section: s("section"),
        department: s("department"),
        nationality: s("nationality"),
        yearsInKsa: s("yearsInKsa"),
        professionInIqama: s("professionInIqama"),
        transferable: s("transferable"),
        availableFor: s("availableFor"),
        sourcing: s("sourcing"),
        externalSource: s("externalSource"),
        rows,
        assessment: s("assessment"),
        hrAction: s("hrAction"),
        secondAssessment: s("secondAssessment"),
        deptAction: s("deptAction"),
        finalAction: s("finalAction"),
      },
    };
    startTransition(async () => {
      const result = interview
        ? await updateInterviewAction({ ...payload, id: interview.id })
        : await createInterviewAction(payload);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? "Please check the highlighted fields." : result.error);
        return;
      }
      toast.success(interview ? "Interview updated." : "Interview saved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {interview ? (
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
          New interview
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {interview ? `Interview — ${interview.applicantName}` : "New interview evaluation"}
            </DialogTitle>
            <DialogDescription>
              Pick the PRR the applicant is interviewed for: the job, section, department and the
              required qualifications fill in.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}

            {employees.length > 0 ? (
              <SelectField
                name="employeePick"
                label="Applicant (from Employees)"
                placeholder="Not in Employees"
                hint="Add the applicant in Employees first (status New hire); their name, nationality and Iqama profession fill in."
                defaultValue={employeeId}
                options={employees.map((e) => ({ value: e.id, label: e.label }))}
                onChange={(id) => {
                  setEmployeeId(id);
                  const picked = employees.find((e) => e.id === id);
                  if (picked && picked.companyId !== companyId) {
                    setCompanyId(picked.companyId);
                    setPrrId("");
                  }
                }}
                errors={errors.employeeId}
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                key={`company-${companyId}`}
                name="companyPick"
                label="Company"
                required
                defaultValue={companyId}
                options={companies.map((c) => ({ value: c.id, label: c.code }))}
                onChange={(v) => {
                  setCompanyId(v);
                  setPrrId("");
                }}
                errors={errors.companyId}
              />
              <SelectField
                key={`prr-${companyId}`}
                name="prrPick"
                label="Reference PRR No."
                placeholder="None"
                defaultValue={prrId}
                options={prrs
                  .filter((p) => p.companyId === companyId)
                  .map((p) => ({ value: p.id, label: `${p.prrNo} — ${p.jobTitle}` }))}
                onChange={setPrrId}
                errors={errors.prrId}
              />
              <DateField
                name="interviewDate"
                label="Interview date"
                required
                defaultValue={interview?.interviewDate ?? today()}
                errors={errors.interviewDate}
              />
            </div>

            <div key={`${companyId}-${prrId}-${employeeId}`} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name="applicantName"
                  label="Name of applicant"
                  required
                  defaultValue={who?.name ?? interview?.applicantName ?? ""}
                  errors={errors.applicantName}
                />
                <TextField
                  name="positionTitle"
                  label="Position applied for"
                  required
                  defaultValue={
                    saved?.positionTitle ??
                    prr?.jobTitle ??
                    interview?.positionTitle ??
                    who?.position ??
                    ""
                  }
                  errors={errors.positionTitle}
                />
                <TextField
                  name="availableFor"
                  label="Available for employment"
                  defaultValue={interview?.details.availableFor ?? ""}
                />
                <TextField
                  name="nationality"
                  label="Nationality"
                  defaultValue={who?.nationality ?? interview?.details.nationality ?? ""}
                />
                <TextField
                  name="yearsInKsa"
                  label="Years in KSA"
                  defaultValue={interview?.details.yearsInKsa ?? ""}
                />
                <TextField
                  name="professionInIqama"
                  label="Profession in Iqama (if local)"
                  defaultValue={
                    who?.professionInIqama ?? interview?.details.professionInIqama ?? ""
                  }
                />
                <TextField
                  name="section"
                  label="Section"
                  defaultValue={d?.section ?? prr?.section ?? interview?.details.section ?? ""}
                />
                <TextField
                  name="department"
                  label="Department / Division"
                  defaultValue={
                    d?.department ??
                    prr?.department ??
                    interview?.details.department ??
                    who?.department ??
                    ""
                  }
                  className="sm:col-span-2"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <ChoiceGroup
                  name="transferable"
                  label="Iqama"
                  defaultValue={interview?.details.transferable ?? ""}
                  options={[
                    { value: "TRANSFERABLE", label: "Transferable" },
                    { value: "NON_TRANSFERABLE", label: "Non-transferable" },
                  ]}
                />
                <ChoiceGroup
                  name="sourcing"
                  label="Sourcing method"
                  defaultValue={d?.sourcing ?? prr?.sourcing ?? interview?.details.sourcing ?? ""}
                  options={[
                    { value: "INTERNAL", label: "Internal" },
                    { value: "EXTERNAL", label: "External" },
                  ]}
                />
                <ChoiceGroup
                  name="externalSource"
                  label="If external"
                  defaultValue={
                    d?.externalSource ??
                    (prr?.externalSource === "LOCAL" || prr?.externalSource === "OVERSEAS"
                      ? prr.externalSource
                      : (interview?.details.externalSource ?? ""))
                  }
                  options={[
                    { value: "LOCAL", label: "Local" },
                    { value: "OVERSEAS", label: "Overseas" },
                  ]}
                />
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">I. Preliminary interview</h3>
                <RowsTable rows={PRELIMINARY_ROWS} saved={d?.rows} required={required} />
                <TextAreaField
                  name="assessment"
                  label="Written assessment"
                  defaultValue={interview?.details.assessment ?? ""}
                  rows={2}
                />
                <ChoiceGroup
                  name="hrAction"
                  label="Action taken by HR"
                  defaultValue={interview?.details.hrAction ?? ""}
                  options={recommendationOptions}
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">
                  II. Second interview (section / branch / department / division head)
                </h3>
                <RowsTable rows={SECOND_ROWS} saved={d?.rows} required={required} />
                <TextAreaField
                  name="secondAssessment"
                  label="Written assessment"
                  defaultValue={interview?.details.secondAssessment ?? ""}
                  rows={2}
                />
                <ChoiceGroup
                  name="deptAction"
                  label="Action taken by section / branch / department / division"
                  defaultValue={interview?.details.deptAction ?? ""}
                  options={recommendationOptions}
                />
                <ChoiceGroup
                  name="finalAction"
                  label="Final action taken"
                  defaultValue={interview?.details.finalAction ?? ""}
                  options={FINAL_ACTIONS.map((f) => ({ value: f, label: FINAL_ACTION_LABELS[f] }))}
                />
              </section>
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
                {pending ? "Saving…" : interview ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RowsTable({
  rows,
  saved,
  required,
}: {
  rows: readonly InterviewRow[];
  saved: InterviewDetails["rows"] | undefined;
  required: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground text-xs">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Factor</th>
            <th className="px-2 py-1.5 text-left font-medium">Required (PRR)</th>
            <th className="px-2 py-1.5 text-left font-medium">Actual</th>
            <th className="w-28 px-2 py-1.5 text-left font-medium">Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = saved?.[r.key];
            return (
              <tr key={r.key} className="border-t">
                <td
                  className="px-2 py-1 whitespace-nowrap"
                  style={{ paddingLeft: `${String(0.5 + r.indent * 0.9)}rem` }}
                >
                  {r.label}
                </td>
                <td className="px-1 py-1">
                  <input
                    aria-label={`${r.label} — required`}
                    name={`r_${r.key}_req`}
                    defaultValue={v?.required ?? required[r.key] ?? ""}
                    className={inputClass}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    aria-label={`${r.label} — actual`}
                    name={`r_${r.key}_act`}
                    defaultValue={v?.actual ?? ""}
                    className={inputClass}
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    aria-label={`${r.label} — met`}
                    name={`r_${r.key}_met`}
                    defaultValue={v?.met ?? ""}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    <option value="MET">Met</option>
                    <option value="UNMET">Unmet</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
