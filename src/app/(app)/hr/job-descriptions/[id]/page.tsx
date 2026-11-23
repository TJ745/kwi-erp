import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { JD_ACKNOWLEDGEMENT, JD_LISTS, JD_NOTE, listItems } from "@/lib/job-description";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getJobDescription } from "@/server/services/hiring";
import { employeeOptions } from "@/server/services/hr-records";
import { EmployeePicker, PageNumbers } from "./print-setup";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Job description" };

function Section({ title }: { title: string }) {
  return <div className="jd-section mt-5 px-2 py-1 font-bold">{title}</div>;
}

function Items({ text }: { text: string | null }) {
  const items = listItems(text);
  if (items.length === 0) return null;
  return (
    <ul className="jd-list mt-0.5 space-y-0.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** A blank to sign on, or the value printed on the line. */
function Blank({ value, className }: { value?: string | undefined; className: string }) {
  return (
    <span className={`inline-block border-b border-black px-1 align-bottom ${className}`}>
      {value ?? " "}
    </span>
  );
}

export default async function JobDescriptionPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ employee?: string }>;
}) {
  const ctx = await requirePagePermission("hr.view");
  const { id } = await params;
  const { employee: employeeId } = await searchParams;

  const [jd, employees] = await Promise.all([
    getJobDescription(ctx, id).catch((error: unknown) => {
      if (error instanceof AppError) notFound();
      throw error;
    }),
    employeeOptions(ctx),
  ]);
  const employee = employeeId ? employees.find((e) => e.id === employeeId) : undefined;
  const duties = JD_LISTS.filter((l) => l.group === "duties");
  const profile = JD_LISTS.filter((l) => l.group === "profile");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6 print:space-y-0 print:p-0">
      <PageNumbers />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hr/job-descriptions">
            <ArrowLeft />
            All job descriptions
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense>
            <EmployeePicker
              employees={employees.map((e) => ({
                id: e.id,
                fullName: e.fullName,
                employeeNo: e.employeeNo,
              }))}
              selected={employee?.id ?? null}
            />
          </Suspense>
          <PrintButton />
        </div>
      </div>

      <article className="jd-sheet rounded-lg border bg-white p-10 text-[14px] leading-snug text-black print:rounded-none print:border-0 print:p-0">
        {/* The thead repeats the heading on every printed page. The bottom
            rule is pinned to the foot of each page (see .jd-foot), just above
            the page number, as on the template. */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <td className="p-0">
                <p className="pr-2 text-right text-[19px] font-bold">Job Description</p>
                <div className="jd-rule mt-2 mb-5" />
              </td>
            </tr>
          </thead>
          {/* Reserves a band above the pinned bottom rule on every page, so
              text never runs into it. */}
          <tfoot>
            <tr>
              <td className="h-0 p-0 print:h-[0.3in]" />
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="p-0 px-2">
                <table className="jd-table w-full">
                  <tbody>
                    <tr>
                      <th className="w-[22%]">Job Title :</th>
                      <td className="font-bold">{jd.title}</td>
                    </tr>
                    <tr>
                      <th>Department :</th>
                      <td>{jd.department ?? ""}</td>
                    </tr>
                    <tr>
                      <th>Reports to :</th>
                      <td>{jd.reportsTo ?? ""}</td>
                    </tr>
                    <tr>
                      <th>Oversees :</th>
                      <td className={jd.oversees ? "" : "italic"}>{jd.oversees ?? "(Optional)"}</td>
                    </tr>
                  </tbody>
                </table>

                <Section title="Duties & Responsibilities :" />
                {duties.map((l) => (
                  <div key={l.key} className="mt-4">
                    <p className="font-bold">{l.label}</p>
                    <Items text={jd[l.key]} />
                  </div>
                ))}
                <p className="mt-5 grid grid-cols-[3.5rem_1fr] text-[13px] italic">
                  <span className="font-bold">Note:</span>
                  <span>{JD_NOTE}</span>
                </p>

                <Section title="Desired Job Profile :" />
                {profile.map((l) => (
                  <div key={l.key} className="mt-4">
                    <p className="font-bold">{l.label}:</p>
                    <Items text={jd[l.key]} />
                  </div>
                ))}

                <div className="jd-keep">
                  <Section title="Employee Acknowledgement:" />
                  <p className="mt-2">{JD_ACKNOWLEDGEMENT}</p>
                  <p className="mt-2 flex items-end gap-2">
                    <span>Employee Name:</span>
                    <Blank value={employee?.fullName} className="flex-1" />
                  </p>
                  <p className="mt-6 flex items-end justify-between gap-4">
                    <span className="flex items-end gap-2 whitespace-nowrap">
                      Emp. #: <Blank value={employee?.employeeNo} className="w-24" />
                    </span>
                    <span className="flex items-end gap-2 whitespace-nowrap">
                      Signature: <Blank className="w-60" />
                    </span>
                    <span className="flex items-end gap-2 whitespace-nowrap">
                      Date: <Blank className="w-44" />
                    </span>
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="jd-foot jd-rule-thin mt-8" />
      </article>
    </div>
  );
}
