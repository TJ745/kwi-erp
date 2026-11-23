import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import { FORM_CODES, ordinalParts } from "@/lib/recruitment-forms";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getJoiningLetterForPrint } from "@/server/services/recruitment";

export const metadata: Metadata = { title: "Joining letter" };

function LongDate({ date }: { date: Date }) {
  const { day, suffix, rest } = ordinalParts(date);
  return (
    <>
      {day}
      <sup>{suffix}</sup> {rest}
    </>
  );
}

const cell = "border border-black px-2 py-1 align-top";
const head = "border border-black bg-neutral-300 px-2 py-1 text-center font-bold";

/** New Appointment Acknowledgment (FM:AP:034), as on the company's form. */
export default async function JoiningLetterPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("hr.view");
  const { id } = await params;
  const letter = await getJoiningLetterForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const { employee } = letter;

  return (
    <FormSheet
      backHref="/hr/joining-letters"
      backLabel="All joining letters"
      title={`Joining letter — ${employee.fullName}`}
      company={employee.company}
      code={FORM_CODES.joining}
      bordered
      className="font-serif text-[14px] leading-snug"
    >
      <p className="mt-4 font-bold">TO</p>
      <p className="font-bold">Administration &amp; Personnel Manager</p>

      <h2 className="joining-title mt-10 text-center text-[17px] font-bold underline">
        NEW APPOINTMENT ACKNOWLEDGMENT
      </h2>

      <div className="mt-10 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span>Employee No</span>
          <span className="inline-block min-w-[11rem] border border-black px-2 py-1.5">
            {employee.employeeNo}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Date</span>
          <span className="inline-block min-w-[14rem] border border-black px-2 py-1.5 text-right">
            <LongDate date={letter.letterDate} />
          </span>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr>
            <th className={`${head} w-[52%]`}>Employee Name</th>
            <th className={head}>Position</th>
            <th className={head}>Section</th>
          </tr>
        </thead>
        <tbody>
          <tr className="h-12">
            <td className={cell}>{employee.fullName}</td>
            <td className={cell}>{letter.positionTitle}</td>
            <td className={cell}>{letter.section}</td>
          </tr>
        </tbody>
      </table>

      <table className="mt-8 w-[44%] border-collapse">
        <thead>
          <tr>
            <th className={head}>Joining Date</th>
          </tr>
        </thead>
        <tbody>
          <tr className="h-8">
            <td className={`${cell} text-center`}>
              <LongDate date={letter.joiningDate} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-12 w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} h-24 w-1/2`}>
              <div className="flex h-full flex-col justify-between">
                <span>Signature of Department Manager</span>
                <span className="mt-12 block">Date:</span>
              </div>
            </td>
            <td className={`${cell} h-24 w-1/2`}>
              <div className="flex h-full flex-col justify-between">
                <span>Signature of General Manager</span>
                <span className="mt-12 block">Date:</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-6 w-full border-collapse">
        <tbody>
          <tr>
            <td className={cell}>
              <strong>Remarks:</strong>
            </td>
          </tr>
          <tr>
            <td className={`${cell} h-8`}>{letter.remarks}</td>
          </tr>
          <tr>
            <td className={`${cell} h-8`} />
          </tr>
          <tr>
            <td className={cell}>
              Circulation:<span className="ml-16">Administration Department</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 h-28 border border-black px-2 py-1">
        <strong className="underline">
          For Administration &amp; Personnel Department Use Only:
        </strong>
      </div>
    </FormSheet>
  );
}
