import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet, Tick } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import {
  FINAL_ACTION_LABELS,
  FINAL_ACTIONS,
  FORM_CODES,
  PRELIMINARY_ROWS,
  RECOMMENDATION_LABELS,
  RECOMMENDATIONS,
  SECOND_ROWS,
  type InterviewRow,
} from "@/lib/recruitment-forms";
import type { InterviewDetails } from "@/lib/schemas/recruitment";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getInterviewForPrint } from "@/server/services/recruitment";

export const metadata: Metadata = { title: "Interview evaluation" };

const GREEN = "bg-[#d8f0cf]";
const label = "font-serif text-[10px] italic";

/** Interview Evaluation Report (FM:AP:006), as on the company's form. */
export default async function InterviewPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.offers.view");
  const { id } = await params;
  const interview = await getInterviewForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const d = interview.details;

  return (
    <FormSheet
      backHref="/hr/interviews"
      backLabel="All interviews"
      title={`Interview — ${interview.applicantName}`}
      subtitle={interview.positionTitle}
      company={interview.company}
      code={FORM_CODES.interview}
      className="text-[10.5px] leading-[1.18]"
    >
      <h2 className="mb-1.5 text-center text-[17px] font-black tracking-wide">
        INTERVIEW EVALUATION REPORT
      </h2>

      {/* Applicant */}
      <table className="w-full table-fixed border-collapse border border-black">
        <colgroup>
          <col className="w-[42%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[28%]" />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={2} className="border-b border-dashed border-neutral-400 px-1">
              <p className={label}>Name of Applicant</p>
              <p className="font-bold">{interview.applicantName}</p>
            </td>
            <td className="border-b border-dashed border-neutral-400 px-1 align-top">
              <p className={`${label} text-center`}>Available for Employment</p>
              <p className="text-center font-bold">{d.availableFor}</p>
            </td>
            <td className="border-l border-black bg-black px-1 align-top font-serif font-bold text-white">
              Reference PRR. No.
            </td>
          </tr>
          <tr>
            <td className="border-b border-dashed border-neutral-400 px-1">
              <p className={label}>Position Applied for</p>
              <p className="font-bold">{interview.positionTitle}</p>
            </td>
            <td className="border-b border-dashed border-neutral-400 px-1">
              <p className={label}>Nationality</p>
              <p className="font-bold">{d.nationality}</p>
            </td>
            <td className="border-b border-dashed border-neutral-400 px-1">
              <p className={label}>Years in KSA</p>
              <p className="font-bold">{d.yearsInKsa}</p>
            </td>
            <td className="border-x border-black px-1 text-center font-bold">
              {interview.prr?.prrNo ?? ""}
            </td>
          </tr>
          <tr>
            <td className="border-b border-dashed border-neutral-400 px-1">
              <p className={label}>Section</p>
              <p className="font-bold">{d.section}</p>
            </td>
            <td colSpan={2} className="border-b border-dashed border-neutral-400 px-1 align-top">
              <p className={label}>Profession in Iqama (If sourced locally)</p>
              <p className="font-bold">{d.professionInIqama}</p>
            </td>
            <td rowSpan={2} className="border border-black px-1 align-top">
              <p className={label}>Sourcing Method</p>
              <p>
                <Tick mark="x" on={d.sourcing === "INTERNAL"} label="Internal" />
              </p>
              <p>
                <Tick mark="x" on={d.sourcing === "EXTERNAL"} label="External" />
              </p>
              <p className="pl-5">
                <Tick mark="x" on={d.externalSource === "LOCAL"} label="Local" />
              </p>
              <p className="pl-5">
                <Tick mark="x" on={d.externalSource === "OVERSEAS"} label="Overseas" />
              </p>
            </td>
          </tr>
          <tr>
            <td className="px-1">
              <p className={label}>Department/ Division</p>
              <p className="font-bold">{d.department}</p>
            </td>
            <td colSpan={2} className="px-1 font-serif">
              <Tick mark="x" on={d.transferable === "TRANSFERABLE"} label="Transferable" />
              <span className="ml-4">
                <Tick
                  mark="x"
                  on={d.transferable === "NON_TRANSFERABLE"}
                  label="Non-transferable"
                />
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* I. Preliminary interview */}
      <div className="mt-3 border border-black">
        <p className="px-1 py-0.5 text-[13px] font-bold">I.&nbsp;&nbsp; PRELIMINARY INTERVIEW</p>
        <FactorTable rows={PRELIMINARY_ROWS} details={d} />
        <Assessment text={d.assessment} />
        <ActionRow
          actionTitle="Action Taken by HR"
          action={d.hrAction}
          middle={{ title: "Interviewed by:", signer: "Recruitment Specialist" }}
          right={{ title: "Noted by:", signer: "Administrative Consultant" }}
        />
      </div>

      {/* II. Second interview */}
      <div className="mt-3 border border-black">
        <p className="px-1 py-0.5 text-[13px] font-bold">
          II.&nbsp;&nbsp; SECOND INTERVIEW{" "}
          <span className="font-serif">(Section/Branch/Department/Division Head)</span>
        </p>
        <FactorTable rows={SECOND_ROWS} details={d} />
        <Assessment text={d.secondAssessment} />
        <ActionRow
          actionTitle="Action Taken by Sect/Branch/Dept/Div"
          action={d.deptAction}
          middle={{
            title: "Interviewed by:",
            signer: "Section/Branch/Department/Division Head",
          }}
          right={{ title: "Final Action Taken:", signer: "Branch/Department/Division Head" }}
          finalAction={d.finalAction}
        />
      </div>
    </FormSheet>
  );
}

function FactorTable({
  rows,
  details,
}: {
  rows: readonly InterviewRow[];
  details: InterviewDetails;
}) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-[24%]" />
        <col className="w-[27%]" />
        <col className="w-[27%]" />
        <col className="w-[22%]" />
      </colgroup>
      <thead>
        <tr className="bg-black text-white">
          <th rowSpan={2} className="py-0.5 text-[11.5px]">
            FACTORS
          </th>
          <th colSpan={2} className="pt-0.5 text-[11.5px] leading-none">
            QUALIFICATIONS
          </th>
          <th rowSpan={2} className="text-[11.5px]">
            SPECIFIC REMARKS
          </th>
        </tr>
        <tr className="bg-black text-white">
          <th className="pb-0.5 text-[11px] leading-none">Personnel Requirement Request</th>
          <th className="pb-0.5 text-[11px] leading-none">Actual</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const v = details.rows[r.key];
          return (
            <tr key={r.key} className="border-b border-dashed border-neutral-400">
              <td
                className="border-r border-black px-1"
                style={{ paddingLeft: `${String(0.25 + r.indent * 0.6)}rem` }}
              >
                {r.label}
              </td>
              <td className="border-r border-black px-1 font-bold">{v?.required ?? ""}</td>
              <td className="border-r border-black px-1 font-bold">{v?.actual ?? ""}</td>
              <td className="px-3">
                <Tick mark="x" on={v?.met === "MET"} label="Met" />
                <span className="ml-4">
                  <Tick mark="x" on={v?.met === "UNMET"} label="Unmet" />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Assessment({ text }: { text: string }) {
  return (
    <>
      <p className="bg-black text-center font-bold text-white">Written Assessment</p>
      <p className="min-h-[1.8rem] px-2 py-1 whitespace-pre-wrap">{text}</p>
    </>
  );
}

function ActionRow({
  actionTitle,
  action,
  middle,
  right,
  finalAction,
}: {
  actionTitle: string;
  action: string;
  middle: { title: string; signer: string };
  right: { title: string; signer: string };
  finalAction?: string;
}) {
  return (
    <div className="grid grid-cols-[30%_36%_34%]">
      <div className={GREEN}>
        <p className="bg-black px-1 font-bold text-white">{actionTitle}</p>
        <div className="space-y-px px-1 py-1">
          {RECOMMENDATIONS.map((r) => (
            <p key={r}>
              <Tick mark="x" on={action === r} label={RECOMMENDATION_LABELS[r]} />
            </p>
          ))}
        </div>
      </div>
      <Signer title={middle.title} signer={middle.signer} />
      <div className="flex flex-col">
        <p className="bg-black px-1 font-bold text-white">{right.title}</p>
        {finalAction !== undefined ? (
          <div className="space-y-px px-1 pt-0.5">
            {FINAL_ACTIONS.map((f) => (
              <p key={f}>
                <Tick mark="x" on={finalAction === f} label={FINAL_ACTION_LABELS[f]} />
              </p>
            ))}
          </div>
        ) : null}
        <SignLine signer={right.signer} />
      </div>
    </div>
  );
}

function Signer({ title, signer }: { title: string; signer: string }) {
  return (
    <div className="flex flex-col">
      <p className="bg-black px-1 font-bold text-white">{title}</p>
      <SignLine signer={signer} />
    </div>
  );
}

function SignLine({ signer }: { signer: string }) {
  return (
    <div className="mt-auto px-4 pb-1">
      <p className="mt-5 border-t border-black text-center">{signer}</p>
      <p className="mt-2 text-center">Date: ________________</p>
    </div>
  );
}
