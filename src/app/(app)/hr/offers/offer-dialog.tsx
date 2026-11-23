"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { readString } from "@/lib/form-data";
import { SELECTABLE_OFFER_STATUSES } from "@/lib/schemas/hiring";
import {
  CONTRACT_YEARS,
  COVERS,
  FAMILY_STATUSES,
  ID_TYPE_LABELS,
  ID_TYPES,
  LEAVE_PLANS,
  offerTotal,
  PROBATION_DAYS,
  SALARY_LINES,
  SALUTATIONS,
  TERM_OPTION_LABELS,
  type SalaryLineKey,
} from "@/lib/job-offer";
import { createJobOfferAction, updateJobOfferAction } from "@/server/actions/hiring";

export type OfferValues = {
  id: string;
  companyId: string;
  candidateName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  salutation: string;
  candidateIdType: string | null;
  candidateIdNumber: string | null;
  candidateAddress: string | null;
  offerDate: string | null;
  refNo: string | null;
  positionId: string | null;
  jobDescriptionId: string | null;
  proposedSalary: string | null;
  currency: string;
  proposedJoiningDate: string | null;
  contractYears: number;
  probationDays: number;
  familyStatus: string;
  leavePlan: string;
  ticketCover: string;
  ticketDestination: string | null;
  medicalCover: string;
  status: string;
  sentAt: string | null;
  notes: string | null;
  interviewId: string | null;
  isConverted: boolean;
} & Record<SalaryLineKey, string | null>;

const plain = (v: string | null) => (v === null ? "" : String(Number(v)));

/** An interview an offer can be made from. */
export type InterviewPick = {
  id: string;
  applicantName: string;
  positionTitle: string;
  companyId: string;
  positionId: string | null;
  interviewDate: string;
};

export function OfferDialog({
  companies,
  positions,
  descriptions,
  interviews = [],
  offer,
  open: controlledOpen,
  onOpenChange,
}: {
  companies: { id: string; code: string; name: string }[];
  positions: { id: string; title: string; companyId: string | null }[];
  descriptions: { id: string; title: string }[];
  /** Interviews to make the offer from: picking one fills name, company, position. */
  interviews?: InterviewPick[] | undefined;
  offer?: OfferValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(offer?.status ?? "DRAFT");
  const [salary, setSalary] = React.useState<Record<SalaryLineKey, string>>(() => ({
    basicSalary: plain(offer?.basicSalary ?? null),
    housingAllowance: plain(offer?.housingAllowance ?? null),
    transportAllowance: plain(offer?.transportAllowance ?? null),
    mobileAllowance: plain(offer?.mobileAllowance ?? null),
  }));
  const total = offerTotal(salary);
  const [interviewId, setInterviewId] = React.useState(offer?.interviewId ?? "");
  // A newly picked interview fills in; otherwise the offer's own values stay.
  const fromInterview =
    interviewId !== (offer?.interviewId ?? "")
      ? interviews.find((i) => i.id === interviewId)
      : undefined;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      companyId: readString(fd, "companyId"),
      candidateName: readString(fd, "candidateName"),
      candidateEmail: readString(fd, "candidateEmail"),
      candidatePhone: readString(fd, "candidatePhone"),
      salutation: readString(fd, "salutation") || "Mr.",
      candidateIdType: readString(fd, "candidateIdType"),
      candidateIdNumber: readString(fd, "candidateIdNumber"),
      candidateAddress: readString(fd, "candidateAddress"),
      offerDate: readString(fd, "offerDate"),
      refNo: readString(fd, "refNo"),
      positionId: readString(fd, "positionId"),
      jobDescriptionId: readString(fd, "jobDescriptionId"),
      ...salary,
      currency: readString(fd, "currency") || "SAR",
      proposedJoiningDate: readString(fd, "proposedJoiningDate"),
      contractYears: readString(fd, "contractYears"),
      probationDays: readString(fd, "probationDays"),
      familyStatus: readString(fd, "familyStatus"),
      leavePlan: readString(fd, "leavePlan"),
      ticketCover: readString(fd, "ticketCover"),
      ticketDestination: readString(fd, "ticketDestination"),
      medicalCover: readString(fd, "medicalCover"),
      status,
      sentAt: readString(fd, "sentAt"),
      notes: readString(fd, "notes"),
      interviewId,
    };

    startTransition(async () => {
      const result = offer
        ? await updateJobOfferAction({ ...values, id: offer.id })
        : await createJobOfferAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(offer ? "Offer updated." : "Offer created.");
      setOpen(false);
      router.refresh();
    });
  }

  const today = new Date().toISOString().slice(0, 10);

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
          New offer
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{offer ? "Edit offer" : "New offer"}</DialogTitle>
              <DialogDescription>
                Fill in the employment offer; it prints like the company letter. Marking an offer
                accepted does not create an employee — use Convert for that, once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              {interviews.length > 0 ? (
                <SelectField
                  name="interviewPick"
                  label="From interview"
                  placeholder="None"
                  hint="Picking an interview fills in the candidate, company and position."
                  options={interviews.map((i) => ({
                    value: i.id,
                    label: `${i.applicantName} — ${i.positionTitle} (${i.interviewDate})`,
                  }))}
                  defaultValue={interviewId}
                  onChange={setInterviewId}
                  errors={errors.interviewId}
                />
              ) : null}

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Candidate</legend>
                <div className="grid gap-4 sm:grid-cols-[6rem_1fr_1fr]">
                  <SelectField
                    name="salutation"
                    label="Title"
                    options={SALUTATIONS.map((s) => ({ value: s, label: s }))}
                    defaultValue={offer?.salutation ?? "Mr."}
                    errors={errors.salutation}
                  />
                  <TextField
                    key={`name-${interviewId}`}
                    name="candidateName"
                    label="Candidate name"
                    required
                    defaultValue={fromInterview?.applicantName ?? offer?.candidateName ?? ""}
                    errors={errors.candidateName}
                    className="sm:col-span-2"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name="candidatePhone"
                    label="Mobile #"
                    defaultValue={offer?.candidatePhone ?? ""}
                    errors={errors.candidatePhone}
                  />
                  <TextField
                    name="candidateEmail"
                    label="Email"
                    type="email"
                    defaultValue={offer?.candidateEmail ?? ""}
                    errors={errors.candidateEmail}
                  />
                  <SelectField
                    name="candidateIdType"
                    label="ID document"
                    placeholder="None"
                    options={ID_TYPES.map((t) => ({ value: t, label: ID_TYPE_LABELS[t] }))}
                    defaultValue={offer?.candidateIdType ?? ""}
                    errors={errors.candidateIdType}
                  />
                  <TextField
                    name="candidateIdNumber"
                    label="Passport / Iqama number"
                    defaultValue={offer?.candidateIdNumber ?? ""}
                    errors={errors.candidateIdNumber}
                  />
                  <TextField
                    name="candidateAddress"
                    label="Address"
                    placeholder="Amman, Jordan"
                    defaultValue={offer?.candidateAddress ?? ""}
                    errors={errors.candidateAddress}
                    className="sm:col-span-2"
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Offer</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    key={`company-${interviewId}`}
                    name="companyId"
                    label="Company"
                    required
                    options={companies.map((c) => ({
                      value: c.id,
                      label: `${c.code} — ${c.name}`,
                    }))}
                    defaultValue={
                      fromInterview?.companyId ?? offer?.companyId ?? companies[0]?.id ?? ""
                    }
                    errors={errors.companyId}
                  />
                  <SelectField
                    key={`position-${interviewId}`}
                    name="positionId"
                    label="Position"
                    placeholder="Not specified"
                    options={positions.map((p) => ({ value: p.id, label: p.title }))}
                    defaultValue={fromInterview?.positionId ?? offer?.positionId ?? ""}
                    errors={errors.positionId}
                  />
                  <DateField
                    name="offerDate"
                    label="Offer date"
                    defaultValue={offer?.offerDate ?? today}
                    errors={errors.offerDate}
                  />
                  <TextField
                    name="refNo"
                    label="Our Ref."
                    hint={
                      offer ? undefined : "Leave blank to number it automatically, e.g. KWI/17/26."
                    }
                    defaultValue={offer?.refNo ?? ""}
                    errors={errors.refNo}
                  />
                  <DateField
                    name="proposedJoiningDate"
                    label="Proposed joining date"
                    defaultValue={offer?.proposedJoiningDate ?? ""}
                    errors={errors.proposedJoiningDate}
                  />
                  <SelectField
                    name="jobDescriptionId"
                    label="Job description"
                    placeholder="Not attached"
                    options={descriptions.map((d) => ({ value: d.id, label: d.title }))}
                    defaultValue={offer?.jobDescriptionId ?? ""}
                    errors={errors.jobDescriptionId}
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Salary (per month)</legend>
                <div className="grid gap-4 sm:grid-cols-4">
                  {SALARY_LINES.map((l) => (
                    <TextField
                      key={l.key}
                      name={l.key}
                      label={l.label}
                      defaultValue={salary[l.key]}
                      onChange={(v) => {
                        setSalary((s) => ({ ...s, [l.key]: v }));
                      }}
                      errors={errors[l.key]}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <p className="text-sm">
                    Total package:{" "}
                    <strong className="tabular-nums">
                      {total === null ? "—" : Number(total).toLocaleString("en-US")}
                    </strong>
                  </p>
                  <TextField
                    name="currency"
                    label="Currency"
                    defaultValue={offer?.currency ?? "SAR"}
                    errors={errors.currency}
                    className="w-28"
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Terms</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <SelectField
                    name="contractYears"
                    label="Contract duration"
                    options={CONTRACT_YEARS.map((y) => ({
                      value: String(y),
                      label: TERM_OPTION_LABELS.contractYears[y],
                    }))}
                    defaultValue={String(offer?.contractYears ?? 1)}
                    errors={errors.contractYears}
                  />
                  <SelectField
                    name="probationDays"
                    label="Probation period"
                    options={PROBATION_DAYS.map((d) => ({
                      value: String(d),
                      label: TERM_OPTION_LABELS.probationDays[d],
                    }))}
                    defaultValue={String(offer?.probationDays ?? 90)}
                    errors={errors.probationDays}
                  />
                  <SelectField
                    name="familyStatus"
                    label="Employment status"
                    options={FAMILY_STATUSES.map((f) => ({
                      value: f,
                      label: TERM_OPTION_LABELS.familyStatus[f],
                    }))}
                    defaultValue={offer?.familyStatus ?? "WITHOUT_FAMILY"}
                    errors={errors.familyStatus}
                  />
                  <SelectField
                    name="leavePlan"
                    label="Leave entitlement"
                    options={LEAVE_PLANS.map((p) => ({
                      value: p,
                      label: TERM_OPTION_LABELS.leavePlan[p],
                    }))}
                    defaultValue={offer?.leavePlan ?? "30_AFTER_1Y"}
                    errors={errors.leavePlan}
                  />
                  <SelectField
                    name="ticketCover"
                    label="Vacation ticket"
                    options={COVERS.map((c) => ({ value: c, label: TERM_OPTION_LABELS.cover[c] }))}
                    defaultValue={offer?.ticketCover ?? "SELF"}
                    errors={errors.ticketCover}
                  />
                  <TextField
                    name="ticketDestination"
                    label="Ticket to (city)"
                    placeholder="Amman"
                    defaultValue={offer?.ticketDestination ?? ""}
                    errors={errors.ticketDestination}
                  />
                  <SelectField
                    name="medicalCover"
                    label="Medical insurance"
                    options={COVERS.map((c) => ({ value: c, label: TERM_OPTION_LABELS.cover[c] }))}
                    defaultValue={offer?.medicalCover ?? "SELF"}
                    errors={errors.medicalCover}
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Tracking</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="field-status">
                      Status<span className="text-destructive">*</span>
                    </label>
                    <select
                      id="field-status"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                      }}
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    >
                      {SELECTABLE_OFFER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {errors.status?.[0] ? (
                      <p className="text-destructive text-xs">{errors.status[0]}</p>
                    ) : null}
                  </div>
                  <DateField
                    name="sentAt"
                    label="Sent on"
                    required={status !== "DRAFT"}
                    {...(status === "DRAFT" ? { hint: "Optional while a draft." } : {})}
                    defaultValue={offer?.sentAt ?? ""}
                    errors={errors.sentAt}
                  />
                </div>
                <TextAreaField
                  name="notes"
                  label="Notes"
                  hint="Not printed."
                  rows={2}
                  defaultValue={offer?.notes ?? ""}
                  errors={errors.notes}
                />
              </fieldset>
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
                {pending ? "Saving…" : offer ? "Save changes" : "Create offer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
