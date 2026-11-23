import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import {
  formatAmount,
  incrementOf,
  SALARY_PARTS,
  total,
  type Breakdown,
  type SalaryPart,
} from "@/lib/increments";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getIncrementList } from "@/server/services/increments";
import { LandscapePrint } from "@/components/shared/landscape-print";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Increment list" };

const HEAD: Record<SalaryPart, string> = {
  basic: "Basic Salary",
  transport: "Transp. Allowance",
  housing: "Housing Allowance",
  other: "Mobile / Food Allowance",
};

const BAND = {
  current: "bg-inc-current print:bg-[#f2f2f2]",
  demanded: "bg-inc-demand print:bg-[#fbd4b4]",
  proposed: "bg-inc-propose print:bg-[#daeef3]",
  highlight: "bg-inc-highlight print:bg-[#ffff00]",
} as const;

/** dd.mm.yyyy, as on the company's sheet. */
function dmy(date: Date): string {
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCFullYear()),
  ].join(".");
}

export default async function IncrementListPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("hr.increments.view");
  if (!ctx.permissions.has("employees.salary.view")) redirect("/hr/increments");
  const { id } = await params;
  const list = await getIncrementList(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  const parts = (b: Breakdown) =>
    SALARY_PARTS.map((p) => (
      <td key={p} className="px-1 py-0.5 text-right">
        {formatAmount(b[p])}
      </td>
    ));

  /** An increment of nothing prints as a blank cell, as on the paper sheet. */
  const inc = (current: Breakdown, next: Breakdown) => {
    const v = incrementOf(current, next);
    return Number(v) === 0 ? "" : formatAmount(v, { dashForZero: false });
  };

  return (
    <div className="mx-auto w-full space-y-4 p-6 print:space-y-0 print:p-0">
      <LandscapePrint />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/hr/increments/${list.id}`}>
            <ArrowLeft />
            Back to the list
          </Link>
        </Button>
        <PrintButton />
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border p-4 print:overflow-visible print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
        <div className="mb-1 flex items-end justify-between text-[11px] font-bold uppercase">
          <span>{list.title}</span>
          <span>{dmy(list.listDate)}</span>
        </div>
        <table className="increment-sheet w-full border-collapse text-[10px] leading-tight">
          <thead className="text-center font-bold">
            <tr>
              <th rowSpan={2} className="px-1">
                Sr
              </th>
              <th rowSpan={2} className="px-1">
                Employee ID
              </th>
              <th rowSpan={2} className="px-1">
                Name
              </th>
              <th rowSpan={2} className="px-1">
                Sponsor
              </th>
              <th rowSpan={2} className="px-1">
                Position
              </th>
              <th colSpan={5} className={`px-1 py-0.5 ${BAND.current}`}>
                CURRENT SALARY
              </th>
              <th colSpan={6} className={`px-1 py-0.5 ${BAND.demanded}`}>
                NEW DEMANDED SALARY
              </th>
              <th colSpan={6} className={`px-1 py-0.5 ${BAND.proposed}`}>
                NEW PROPOSED SALARY
              </th>
            </tr>
            <tr>
              {SALARY_PARTS.map((p) => (
                <th key={`c${p}`} className={`px-1 ${BAND.current}`}>
                  {HEAD[p]}
                </th>
              ))}
              <th className={`px-1 ${BAND.current}`}>Total Salary</th>
              <th className={`px-1 ${BAND.demanded}`}>Increment Demand</th>
              {SALARY_PARTS.map((p) => (
                <th key={`d${p}`} className={`px-1 ${BAND.demanded}`}>
                  {HEAD[p]}
                </th>
              ))}
              <th className={`px-1 ${BAND.demanded}`}>Total Salary</th>
              <th className={`px-1 ${BAND.proposed}`}>Increment Proposed</th>
              {SALARY_PARTS.map((p) => (
                <th key={`p${p}`} className={`px-1 ${BAND.proposed}`}>
                  {HEAD[p]}
                </th>
              ))}
              <th className={`px-1 ${BAND.proposed}`}>Total Salary</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {list.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="px-1 py-0.5 text-center">{i + 1}</td>
                <td className="px-1 py-0.5 text-center">{l.employeeNo}</td>
                <td className="px-1 py-0.5">{l.name}</td>
                <td className="px-1 py-0.5 text-center">{l.sponsor}</td>
                <td className="px-1 py-0.5">{l.position}</td>
                {parts(l.current)}
                <td className="px-1 py-0.5 text-right">{formatAmount(total(l.current))}</td>
                <td className="px-1 py-0.5 text-center">{inc(l.current, l.demanded)}</td>
                {parts(l.demanded)}
                <td className="px-1 py-0.5 text-right">{formatAmount(total(l.demanded))}</td>
                <td className="px-1 py-0.5 text-center font-bold text-[#c00000]">
                  {inc(l.current, l.proposed)}
                </td>
                {parts(l.proposed)}
                <td className="px-1 py-0.5 text-right">{formatAmount(total(l.proposed))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold tabular-nums">
            <tr>
              <td colSpan={5} className="px-1 py-0.5 text-right">
                Total Amount SR
              </td>
              {parts(list.totals.current)}
              <td className="px-1 py-0.5 text-right">{formatAmount(total(list.totals.current))}</td>
              <td className={`px-1 py-0.5 text-center ${BAND.highlight}`}>
                {formatAmount(incrementOf(list.totals.current, list.totals.demanded), {
                  dashForZero: false,
                })}
              </td>
              {parts(list.totals.demanded)}
              <td className="px-1 py-0.5 text-right">
                {formatAmount(total(list.totals.demanded))}
              </td>
              <td className={`px-1 py-0.5 text-center text-[#c00000] ${BAND.highlight}`}>
                {formatAmount(incrementOf(list.totals.current, list.totals.proposed), {
                  dashForZero: false,
                })}
              </td>
              {parts(list.totals.proposed)}
              <td className="px-1 py-0.5 text-right">
                {formatAmount(total(list.totals.proposed))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
