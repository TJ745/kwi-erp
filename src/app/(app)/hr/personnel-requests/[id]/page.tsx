import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet, Tick } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import { EDUCATION_LABELS, EDUCATION_LEVELS, FORM_CODES } from "@/lib/recruitment-forms";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getPrrForPrint } from "@/server/services/recruitment";

export const metadata: Metadata = { title: "Personnel requirement request" };

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear())}`;

/** A typed-in answer on a form line. */
function Line({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block border-b border-black px-1 font-bold ${className}`}>
      {children ?? ""}
      {" "}
    </span>
  );
}

function Bar({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="mt-2 flex bg-black px-2 py-[2px] text-[11px] font-bold text-white">
      <span className="w-10">{n}</span>
      <span className="small-caps">
        {title}
        {note ? <i className="font-serif font-normal"> ({note})</i> : null}
      </span>
    </div>
  );
}

/** Personnel Requirement Request (FM:AP:002), as on the company's form. */
export default async function PrrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.offers.view");
  const { id } = await params;
  const prr = await getPrrForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const d = prr.details;
  const edu = (list: readonly string[]) =>
    EDUCATION_LEVELS.map((e) => <Tick key={e} on={list.includes(e)} label={EDUCATION_LABELS[e]} />);

  return (
    <FormSheet
      backHref="/hr/personnel-requests"
      backLabel="All requests"
      title={`${prr.prrNo} — ${prr.jobTitle}`}
      company={prr.company}
      code={FORM_CODES.prr}
      className="text-[11.5px] leading-snug"
    >
      <h2 className="mb-1.5 text-center text-[17px] font-black tracking-wide">
        PERSONNEL REQUIREMENT REQUEST
      </h2>

      <div className="border-2 border-black">
        {/* Notes and HR box */}
        <div className="grid grid-cols-[1fr_17rem] border-b-2 border-black">
          <div className="border-r-2 border-black">
            <p className="small-caps bg-black px-2 text-[11px] font-bold text-white">Notes:</p>
            <ul className="list-disc space-y-1 py-1.5 pr-2 pl-6 text-[11px]">
              <li>
                Please fill out completely this PRR before submitting it to HR. Job Description
                should be attached to it if a request is for a new position.
              </li>
              <li>Each PRR is used for a requisition for one specific job vacancy only.</li>
              <li>
                There is a specific processing timeline for each PRR. A shorter timeline may be
                agreed upon between the requisitioning division/department and HR according to
                exigencies.
              </li>
            </ul>
          </div>
          <div>
            <p className="small-caps bg-black px-2 text-right text-[11px] font-bold text-white">
              For HR Specialist Use Only
            </p>
            <div className="space-y-2 p-2">
              <p className="flex gap-2">
                <span className="w-24">Date Received</span>:
                <Line className="flex-1">{dmy(prr.requestDate)}</Line>
              </p>
              <p className="flex gap-2">
                <span className="w-24">PRR No.</span>:<Line className="flex-1">{prr.prrNo}</Line>
              </p>
              <p className="text-center text-[11px] font-bold">
                Below are Employee Numbers
                <br />
                of Employees Hired by virtue of this PRR
              </p>
              <p className="text-center font-bold">
                {prr.hired.map((e) => e.employeeNo).join(", ")}
              </p>
            </div>
          </div>
        </div>

        <div className="px-0 pb-2">
          <Bar n="I." title="Personnel Requisitioned" />
          <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 px-12 pt-1">
            <p className="flex">
              <span className="w-40">Job Title:</span>:
              <Line className="ml-2 flex-1">{prr.jobTitle}</Line>
            </p>
            <p className="flex">
              <span className="w-28">No. of Vacancies</span>:
              <Line className="ml-2 w-28">{prr.vacancies}</Line>
            </p>
            <p className="flex">
              <span className="w-40">Section</span>:<Line className="ml-2 flex-1">{d.section}</Line>
            </p>
            <p className="flex">
              <span className="w-28">Date Needed</span>:
              <Line className="ml-2 w-28">{d.dateNeeded}</Line>
              <i className="ml-1 font-serif">(in months)</i>
            </p>
            <p className="col-span-2 flex">
              <span className="w-40">Division/Department</span>:
              <Line className="ml-2 w-80">{d.divisionDepartment || prr.department?.name}</Line>
            </p>
          </div>

          <Bar n="II." title="Purpose of Requisition" />
          <div className="space-y-1 px-12 pt-1">
            <p>
              <Tick on={d.purpose === "NEW"} label="New Position" /> <b>(</b>
              <i className="font-serif">
                If the position requested does not exist in a specific section of a
                division/department
              </i>
              <b>)</b>
            </p>
            <p>
              <Tick on={d.purpose === "ADDITIONAL"} label="Additional Employee" /> <b>(</b>
              <i className="font-serif">
                If the position requested is one of the approved job titles in a specific section of
                a division/department
              </i>
              <b>)</b>
            </p>
            <p className="flex items-end">
              <Tick on={d.purpose === "REPLACEMENT"} label="Replacement of" />
              <Line className="ml-3 w-56">{d.replacementOf}</Line>
              <span className="ml-3">
                Remarks <b>(</b>
                <i className="font-serif">For HR Use Only</i>
                <b>)</b>:
              </span>
              <Line className="ml-2 flex-1">{d.hrRemarks}</Line>
            </p>
          </div>

          <Bar n="III." title="Basic Qualifications" />
          <div className="space-y-1 px-12 pt-1">
            <div className="grid grid-cols-[7rem_8rem_1fr] items-center">
              <span>1. Education</span>
              <span>: a. Required</span>
              <span className="flex gap-8">: {edu(d.educationRequired)}</span>
              <span />
              <span>&nbsp; b. Preferable</span>
              <span className="flex gap-8">: {edu(d.educationPreferable)}</span>
              <span />
              <span>&nbsp; Specialization:</span>
              <Line>{d.specialization}</Line>
            </div>
            <div className="grid grid-cols-[7rem_8rem_1fr] items-center">
              <span>2. Experience</span>
              <span>: a. Fields</span>
              <span className="flex">
                :<Line className="ml-2 flex-1 text-center">{d.experienceFields}</Line>
              </span>
              <span />
              <span>&nbsp; b. No. of Years</span>
              <span className="flex items-end">
                : Minimum <Line className="ml-1 w-28">{d.yearsMin}</Line>
                <span className="ml-auto">Maximum</span>
                <Line className="ml-1 w-28">{d.yearsMax}</Line>
              </span>
            </div>
            <div className="grid grid-cols-[7rem_1fr] items-center">
              <span>3. Skills</span>
              <span className="flex">
                :<Line className="ml-2 flex-1">{d.skills}</Line>
              </span>
              <span>4. Language</span>
              <span className="flex gap-24">
                <span>:</span>
                <Tick on={d.language === "ARABIC"} label="Arabic" />
                <Tick on={d.language === "ENGLISH"} label="English" />
                <Tick on={d.language === "BOTH"} label="Both" />
              </span>
            </div>
          </div>

          <Bar n="IV." title="Sourcing Method" />
          <div className="space-y-1 px-12 pt-1">
            <p className="flex gap-24">
              <Tick on={d.sourcing === "INTERNAL"} label="Internal" />
              <Tick on={d.sourcing === "EXTERNAL"} label="External" />
            </p>
            <p className="flex gap-24 pl-44">
              <Tick on={d.externalSource === "LOCAL"} label="Local" />
              <Tick on={d.externalSource === "OVERSEAS"} label="Overseas" />
              <Tick on={d.externalSource === "MANPOWER"} label="Manpower Supply" />
            </p>
          </div>

          <Bar n="V." title="Justification" />
          <div className="px-12 pt-1">
            <p className="min-h-[1.8rem] border-b border-black font-bold whitespace-pre-wrap">
              {d.justification}
            </p>
            <p className="h-4 border-b border-black" />
          </div>

          <Bar n="VI." title="Manpower Inventory" note="For HR Use Only" />
          <div className="px-12 pt-1">
            <table className="w-full table-fixed border-collapse border border-black text-center text-[10.5px]">
              <thead>
                <tr>
                  <th className="border border-black font-normal">
                    Approved
                    <br />
                    Manpower Budget
                    <br />
                    (A)
                  </th>
                  <th className="border border-black font-normal">
                    Current
                    <br />
                    Manpower Headcount
                    <br />
                    (B)
                  </th>
                  <th className="border border-black font-normal">
                    Projected
                    <br />
                    Additional Manpower
                    <br />
                    (A – B)
                  </th>
                  <th className="border border-black font-normal">
                    Number of
                    <br />
                    Requested Manpower
                    <br />
                    (C)
                  </th>
                  <th className="border border-black font-normal">
                    <b>Remarks</b>
                    <br />
                    <span className="font-serif">(X = within the budget)</span>
                    <br />
                    <span className="font-serif">(Y = beyond the budget)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-6 font-bold">
                  <td className="border border-black">{d.manpowerBudget}</td>
                  <td className="border border-black">{d.manpowerHeadcount}</td>
                  <td className="border border-black">{d.manpowerProjected}</td>
                  <td className="border border-black">{d.manpowerRequested}</td>
                  <td className="border border-black">{d.manpowerRemarks}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Bar n="VII." title="Signatories" />
          <div className="grid grid-cols-3 gap-6 px-12 pt-7">
            {["Department/Division Head", "HR & Admin Manager", "President/General Manager"].map(
              (s) => (
                <div key={s}>
                  <p className="border-t border-black text-center">{s}</p>
                  <p className="flex">
                    Date:
                    <span className="ml-2 flex-1 border-b border-black" />
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px]">
        <b>Distribution</b>:{" "}
        <i className="font-serif">Original Copy – Master File; Photocopy – 201 File</i>
      </p>
    </FormSheet>
  );
}
