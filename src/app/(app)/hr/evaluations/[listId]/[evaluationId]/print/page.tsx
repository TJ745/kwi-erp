import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandscapePrint } from "@/components/shared/landscape-print";
import { AppError } from "@/lib/result";
import {
  PROGRESS_MARKS,
  progressMarksReached,
  STAFF_COMPETENCIES,
  STAFF_DEVELOPMENT_ROWS,
  STAFF_GOAL_ROWS,
  STAFF_TEXT,
  SUMMARY_BOXES,
  summaryBoxOf,
  WORKER_CRITERIA,
  WORKER_INSTRUCTIONS,
  WORKER_SCALE,
  workerResult,
  type StaffData,
  type WorkerData,
} from "@/lib/evaluation-forms";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getEvaluation } from "@/server/services/evaluations";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Evaluation" };

const dmy = (d: Date | null) =>
  d
    ? [
        String(d.getUTCDate()).padStart(2, "0"),
        String(d.getUTCMonth() + 1).padStart(2, "0"),
        String(d.getUTCFullYear()),
      ].join("/")
    : "";

type Loaded = Awaited<ReturnType<typeof getEvaluation>>;

export default async function EvaluationPrintPage({
  params,
}: {
  params: Promise<{ listId: string; evaluationId: string }>;
}) {
  const ctx = await requirePagePermission("hr.evaluations.view");
  const { listId, evaluationId } = await params;
  const e = await getEvaluation(ctx, evaluationId).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  if (e.list.id !== listId) notFound();

  return (
    <div className="mx-auto w-full space-y-4 p-6 print:space-y-0 print:p-0">
      {e.template === "STAFF" ? <LandscapePrint /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/hr/evaluations/${listId}/${e.id}`}>
            <ArrowLeft />
            Back to the form
          </Link>
        </Button>
        <PrintButton />
      </div>
      {e.staff ? <StaffSheet e={e} data={e.staff} /> : null}
      {e.worker ? <WorkerSheet e={e} data={e.worker} /> : null}
    </div>
  );
}

function Logo({ e, className }: { e: Loaded; className: string }) {
  const company = e.employee.company;
  if (company.headerImageFileId === null) {
    return <p className="text-center text-lg font-semibold">{company.name}</p>;
  }
  return (
    // Served from a session-gated route, so next/image cannot fetch it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/companies/${company.id}/branding/header`}
      alt={company.name}
      className={className}
    />
  );
}

// --- Staff: three landscape pages ---------------------------------------------------

function Band({ en, ar, className = "" }: { en: string; ar: string; className?: string }) {
  return (
    <div
      className={`eval-band flex items-center justify-between px-3 py-1.5 font-bold ${className}`}
    >
      <span>{en}</span>
      <span dir="rtl" lang="ar">
        {ar}
      </span>
    </div>
  );
}

function H({
  en,
  ar,
  className = "",
  rowSpan,
}: {
  en: string;
  ar?: string;
  className?: string;
  rowSpan?: number;
}) {
  return (
    <th
      {...(rowSpan ? { rowSpan } : {})}
      className={`eval-head px-1 py-0.5 text-center font-bold ${className}`}
    >
      <span className="block">{en}</span>
      {ar ? (
        <span dir="rtl" lang="ar" className="block">
          {ar}
        </span>
      ) : null}
    </th>
  );
}

function StaffSheet({ e, data }: { e: Loaded; data: StaffData }) {
  const goals = [
    ...data.goals,
    ...Array.from({ length: STAFF_GOAL_ROWS - data.goals.length }, () => null),
  ];
  const dev = [
    ...data.development,
    ...Array.from({ length: STAFF_DEVELOPMENT_ROWS - data.development.length }, () => null),
  ];
  const left = STAFF_COMPETENCIES.slice(0, 5);
  const right = STAFF_COMPETENCIES.slice(5);
  const T = STAFF_TEXT;

  return (
    <div className="eval-sheet bg-white text-[10px] leading-snug text-black">
      {/* Page 1 */}
      <section className="eval-page">
        <Logo e={e} className="mx-auto mb-1 max-h-[16mm] object-contain" />
        <div className="eval-box">
          <Band en={T.title.en} ar={T.title.ar} className="text-[13px]" />
          <table className="eval-table w-full">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[29%]" />
              <col className="w-[8.5%]" />
              <col className="w-[8.5%]" />
            </colgroup>
            <tbody>
              {/* Labels on the left and "Time in Position" span both rows of
                  their block, as on the paper form. */}
              <tr>
                <H en={T.employeeName.en} ar={T.employeeName.ar} rowSpan={2} />
                <td rowSpan={2} className="px-2">
                  {e.employee.fullName}
                </td>
                <H en={T.currentPosition.en} ar={T.currentPosition.ar} />
                <td className="px-2">{e.employee.position?.title ?? ""}</td>
                <H en={T.timeInPosition.en} ar={T.timeInPosition.ar} rowSpan={2} />
                <td rowSpan={2} className="px-2 text-center">
                  {e.timeInPosition ?? ""}
                </td>
              </tr>
              <tr>
                <H en={T.id.en} />
                <td className="px-2">{e.employee.employeeNo}</td>
              </tr>
              <tr>
                <H en={T.managerName.en} ar={T.managerName.ar} rowSpan={2} />
                <td rowSpan={2} className="px-2">
                  {e.manager?.fullName ?? ""}
                </td>
                <H en={T.managerPosition.en} ar={T.managerPosition.ar} />
                <td className="px-2">{e.manager?.position?.title ?? ""}</td>
                <H en={T.pdpStarted.en} ar={T.pdpStarted.ar} />
                <H en={T.pdpCompleted.en} ar={T.pdpCompleted.ar} />
              </tr>
              <tr>
                <H en={T.id.en} />
                <td className="px-2">{e.manager?.employeeNo ?? ""}</td>
                <td className="px-2 text-center">{dmy(e.pdpStarted)}</td>
                <td className="px-2 text-center">{dmy(e.pdpCompleted)}</td>
              </tr>
            </tbody>
          </table>
          <Band en={T.actionPlan.en} ar={T.actionPlan.ar} className="text-[13px]" />
          <table className="eval-table w-full">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[5.5%]" />
              <col className="w-[13%]" />
              <col className="w-[36%]" />
              <col className="w-[8%]" />
              <col className="w-[5.5%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr>
                <H en={T.goalsCategory.en} ar={T.goalsCategory.ar} />
                <th className="eval-head px-1 text-center font-bold text-[#e00000]">
                  Weight (0% out of 100%)
                </th>
                <H en={T.deliverables.en} ar={T.deliverables.ar} />
                <H en={T.successMeasures.en} ar={T.successMeasures.ar} />
                <H en={T.timeline.en} ar={T.timeline.ar} />
                <H en={T.rating.en} ar={T.rating.ar} />
                <H en={T.results.en} ar={T.results.ar} />
              </tr>
            </thead>
            <tbody>
              {goals.map((g, i) => (
                <tr key={i} className="h-[19mm] align-top whitespace-pre-wrap">
                  <td className="p-1">{g?.category}</td>
                  <td className="p-1 text-center">{g?.weight ? `${g.weight}%` : ""}</td>
                  <td className="p-1">{g?.deliverables}</td>
                  <td className="p-1">{g?.actionPlan}</td>
                  <td className="p-1 text-center">{g?.timeline}</td>
                  <td className="p-1 text-center font-bold">{g?.rating}</td>
                  <td className="p-1">{g?.results}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Page 2 */}
      <section className="eval-page">
        <div className="eval-box">
          <Band en={T.competencies.en} ar={T.competencies.ar} className="text-[12px]" />
          <table className="eval-table w-full">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[5.5%]" />
              <col className="w-[33%]" />
              <col className="w-[25%]" />
              <col className="w-[5.5%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr>
                <H en={T.competency.en} ar={T.competency.ar} />
                <H en={T.rating.en} ar={T.rating.ar} />
                <H en={T.comment.en} ar={T.comment.ar} className="eval-split" />
                <H en={T.comment.en} ar={T.comment.ar} />
                <H en={T.rating.en} ar={T.rating.ar} />
                <H en={T.competency.en} ar={T.competency.ar} />
              </tr>
            </thead>
            <tbody>
              {left.map((l, i) => {
                const r = right[i]!;
                return (
                  <tr key={l.key} className="h-[14mm]">
                    <td className="eval-label px-1 text-center font-bold">
                      <span className="block">{l.en}</span>
                      <span dir="rtl" lang="ar" className="block">
                        {l.ar}
                      </span>
                    </td>
                    <td className="text-center text-[12px] font-bold">
                      {data.competencies[l.key].rating}
                    </td>
                    <td className="eval-split px-1">{data.competencies[l.key].comment}</td>
                    <td className="px-1">{data.competencies[r.key].comment}</td>
                    <td className="text-center text-[12px] font-bold">
                      {data.competencies[r.key].rating}
                    </td>
                    <td className="eval-label px-1 text-center font-bold">
                      <span className="block">{r.en}</span>
                      <span dir="rtl" lang="ar" className="block">
                        {r.ar}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Band en={T.developmentPlan.en} ar={T.developmentPlan.ar} className="text-[13px]" />
          <table className="eval-table w-full">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[39%]" />
              <col className="w-[46%]" />
            </colgroup>
            <thead>
              <tr className="h-[15mm]">
                <H en={T.developmentAreas.en} ar={T.developmentAreas.ar} />
                <H en={T.observed.en} ar={T.observed.ar} />
                <H en={T.addressed.en} ar={T.addressed.ar} />
              </tr>
            </thead>
            <tbody>
              {dev.map((d, i) => (
                <tr key={i} className="h-[16mm] align-top whitespace-pre-wrap">
                  <td className="p-1">{d?.area}</td>
                  <td className="p-1">{d?.observed}</td>
                  <td className="p-1">{d?.addressed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Page 3 */}
      <section className="eval-page">
        <div className="eval-box">
          <Band en={T.managerComments.en} ar={T.managerComments.ar} className="py-5 text-[13px]" />
          <div className="h-[42mm] p-2 whitespace-pre-wrap">{e.managerComments}</div>
          <Band
            en={T.employeeComments.en}
            ar={T.employeeComments.ar}
            className="py-5 text-[13px]"
          />
          <div className="h-[50mm] p-2 whitespace-pre-wrap">{e.employeeComments}</div>
          <table className="eval-table w-full">
            <colgroup>
              <col className="w-[21%]" />
              <col className="w-[33%]" />
              <col className="w-[29%]" />
              <col className="w-[17%]" />
            </colgroup>
            <tbody>
              <tr>
                {[T.employeeSignature, T.managerSignature, T.hrSignature, T.finalRating].map(
                  (l) => (
                    <th key={l.en} className="eval-head px-2 py-0.5 font-bold">
                      <span className="flex justify-between">
                        <span>{l.en}</span>
                        <span dir="rtl" lang="ar">
                          {l.ar}
                        </span>
                      </span>
                    </th>
                  ),
                )}
              </tr>
              <tr className="h-[21mm]">
                <td />
                <td />
                <td />
                <td className="text-center text-[16px] font-bold">{e.finalRating ?? ""}</td>
              </tr>
              <tr>
                {[0, 1, 2, 3].map((i) => (
                  <th key={i} className="eval-head px-2 py-0.5 font-bold">
                    <span className="flex justify-between">
                      <span>{T.date.en}</span>
                      <span dir="rtl" lang="ar">
                        {T.date.ar}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
              <tr className="h-[10mm]">
                <td />
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// --- Worker: one portrait page ---------------------------------------------------------

function Line({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <p className={`flex items-end gap-1 font-bold ${className}`}>
      <span className="whitespace-nowrap">{label}</span>
      <span className="min-w-0 flex-1 border-b border-black px-1 font-normal">{value || " "}</span>
    </p>
  );
}

function CriterionBox({ c, score }: { c: (typeof WORKER_CRITERIA)[number]; score: string }) {
  return (
    <div className="flex items-end">
      <div className="flex-1 border border-black px-2 py-1.5 text-center">
        <p className="font-bold">{c.title}</p>
        <p className={c.text.length > 70 ? "text-[9px]" : ""}>{c.text}</p>
      </div>
      <div className="-ml-px flex h-[11mm] w-[12mm] items-center justify-center border border-black text-[14px] font-bold">
        {score}
      </div>
    </div>
  );
}

function WorkerSheet({ e, data }: { e: Loaded; data: WorkerData }) {
  const result = workerResult(data);
  const reached = progressMarksReached(result);
  const col = (n: 1 | 2 | 3) => WORKER_CRITERIA.filter((c) => c.column === n);
  const box = summaryBoxOf(result);

  return (
    <div className="eval-sheet mx-auto max-w-[200mm] bg-white text-[11px] leading-snug text-black print:max-w-none">
      <Logo e={e} className="mx-auto max-h-[22mm] object-contain" />
      <h1 className="mt-3 text-center text-[15px] font-bold">PERFORMANCE APPRAISAL</h1>

      <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3">
        <Line label="Department:" value={e.employee.department?.name ?? ""} />
        <Line label="Name of employee:" value={e.employee.fullName} />
        <Line label="Position:" value={e.employee.position?.title ?? ""} />
        <Line label="Section :" value={e.section ?? ""} />
        <Line label="Employee no. :" value={e.employee.employeeNo} />
        <Line label="Date of joining:" value={dmy(e.employee.joiningDate)} />
        <Line label="Date of Evaluation:" value={dmy(e.evaluationDate)} />
      </div>

      <p className="mt-4 text-center font-bold tracking-[0.3em] underline">INSTRUCTIONS</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-8 text-[10px]">
        {WORKER_INSTRUCTIONS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-x-5">
        <div className="space-y-3">
          <div className="border-2 border-dashed border-black p-2 text-[10px]">
            {WORKER_SCALE.map((s) => (
              <p key={s.label} className="grid grid-cols-[5.5rem_1fr]">
                <span className="font-bold">{s.label}</span>
                <span>{s.points}</span>
              </p>
            ))}
          </div>
          {col(1).map((c) => (
            <CriterionBox key={c.key} c={c} score={data.scores[c.key]} />
          ))}
        </div>
        <div className="space-y-3 pt-6">
          {col(2).map((c) => (
            <CriterionBox key={c.key} c={c} score={data.scores[c.key]} />
          ))}
        </div>
        <div className="space-y-3">
          {col(3).map((c) => (
            <CriterionBox key={c.key} c={c} score={data.scores[c.key]} />
          ))}
          <div>
            <div className="eval-meter border border-black px-2 pt-1">
              <p className="font-bold">
                Progress Meter{result === null ? "" : ` — ${String(result)}%`}
              </p>
              <div className="mt-0.5 grid grid-cols-10">
                {PROGRESS_MARKS.map((m, i) => (
                  <span
                    key={m}
                    className={`h-3 border-l border-black ${i < reached ? "eval-meter-fill" : ""}`}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-10 text-center text-[8px]">
              {PROGRESS_MARKS.map((m) => (
                <span key={m}>{m}%</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-center text-[10px] font-bold">PERFORMANCE RESULT SUMMARY</p>
            <div className="grid grid-cols-4 text-center text-[9px]">
              {SUMMARY_BOXES.map((b) => (
                <span key={b.box}>{b.label}</span>
              ))}
            </div>
            <div className="eval-summary grid grid-cols-4 border border-black">
              {SUMMARY_BOXES.map((b) => (
                <span
                  key={b.box}
                  className="flex h-[10mm] items-center justify-center border-r border-black font-bold last:border-r-0"
                >
                  {b.box === box && result !== null ? `${String(result)}%` : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
