import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandscapePrint } from "@/components/shared/landscape-print";
import { PrintPageButton } from "@/components/shared/print-page-button";
import { AppError } from "@/lib/result";
import { cn } from "@/lib/utils";
import {
  delayLabel,
  longOrdinal,
  monthLabel,
  rowSegments,
  rowTotals,
  weekendCode,
} from "@/lib/timesheet";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getTimesheet } from "@/server/services/timesheet-sheets";

export const metadata: Metadata = { title: "Timesheet" };

const cell = "border border-black text-center align-middle";
const CODE_PRINT: Record<string, string> = {
  A: "bg-yellow-300 text-red-600",
  FRI: "bg-neutral-300",
  SAT: "bg-neutral-300",
  L: "bg-neutral-300",
  S: "bg-sky-200",
};

/** The company's TIME SHEET, landscape, for signatures. */
export default async function TimesheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.timesheet.view");
  const { id } = await params;
  const sheet = await getTimesheet(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const saudi = sheet.group === "SAUDI";
  const dates = sheet.days.map((d) => new Date(`${d}T00:00:00Z`));
  const brand = sheet.companies.find((c) => c.headerImageFileId) ?? sheet.companies[0];
  const totalsHead = saudi
    ? [
        "WORKING DAYS",
        "ABSENT DAYS",
        "Vacation/Non Working days",
        "FRIDAYS & HOLIDAYS",
        "MONTH DAYS",
        "DELAY TIME HRS",
      ]
    : [
        "WORKING DAYS",
        "ABSENT DAYS",
        "Vacation/Non Working days",
        "FRIDAYS & HOLIDAYS",
        "MONTH DAYS",
        "OVERTIME HRS",
        "Food Allowance",
      ];

  return (
    <div className="mx-auto w-full space-y-4 p-6 print:space-y-0 print:p-0">
      <LandscapePrint />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/people/timesheet/${sheet.id}`}>
            <ArrowLeft />
            Back to the sheet
          </Link>
        </Button>
        <PrintPageButton />
      </div>

      <div
        className="timesheet-print doc-paper bg-white text-[8.5px] leading-tight text-black"
        style={{
          fontFamily: "Calibri, Carlito, Arial, sans-serif",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            {/* Repeated on every printed page: logo, title, column headings. */}
            <tr>
              <td colSpan={3 + dates.length + totalsHead.length} className="pb-1">
                <div className="grid grid-cols-3 items-end">
                  <div>
                    {brand?.headerImageFileId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/companies/${brand.id}/branding/header`}
                        alt={brand.name}
                        className="max-h-[16mm] max-w-[70mm] object-contain object-left"
                      />
                    ) : (
                      <p className="text-[13px] font-bold">{brand?.name}</p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-bold underline">TIME SHEET</p>
                    <p className="text-[11px] font-bold">{monthLabel(sheet.monthKey)}</p>
                  </div>
                  <div />
                </div>
              </td>
            </tr>
            <tr className="font-bold">
              <th rowSpan={2} className={cn(cell, "w-6")}>
                S.No
              </th>
              <th rowSpan={2} className={cn(cell, "w-12")}>
                {sheet.title.replace(/^S_/, "")} Employee #
              </th>
              <th rowSpan={2} className={cn(cell, "w-40")}>
                Name
              </th>
              {sheet.days.map((d) => (
                <th key={d} className={cn(cell, "h-9 w-[18px] p-0 font-normal text-red-600")}>
                  <span className="inline-block rotate-180 text-[7.5px] [writing-mode:vertical-rl]">
                    {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </th>
              ))}
              {totalsHead.map((h) => (
                <th key={h} rowSpan={2} className={cn(cell, "w-9 px-0.5 text-[7.5px]")}>
                  {h}
                </th>
              ))}
            </tr>
            <tr>
              {dates.map((d, i) => (
                <th key={i} className={cn(cell, "h-6 p-0 font-normal")}>
                  <span className="inline-block rotate-180 text-[7.5px] [writing-mode:vertical-rl]">
                    {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {sheet.rows.map((row, n) => {
            const t = rowTotals(row.days, row.extra);
            const segments = rowSegments(row.days);
            return (
              <tbody key={row.employeeId} className="break-inside-avoid">
                <tr className="h-[15px]">
                  <td rowSpan={2} className={cell}>
                    {n + 1}
                  </td>
                  <td rowSpan={2} className={cell}>
                    {row.employeeNo}
                  </td>
                  <td rowSpan={2} className={cn(cell, "px-1 text-left")}>
                    {row.fullName}
                  </td>
                  {segments.map((s) =>
                    s.kind === "gap" ? (
                      <td
                        key={`g${String(s.start)}`}
                        colSpan={s.length}
                        rowSpan={2}
                        className={cn(cell, "bg-yellow-300 text-[10px] font-semibold")}
                      >
                        {s.before
                          ? `Joining Date: ${longOrdinal(new Date(`${row.joiningDate}T00:00:00Z`))}`
                          : row.lastWorkingDate
                            ? `Last Working Day: ${longOrdinal(new Date(`${row.lastWorkingDate}T00:00:00Z`))}`
                            : ""}
                      </td>
                    ) : (
                      <td
                        key={s.index}
                        className={cn(cell, "p-0 font-semibold", CODE_PRINT[row.days[s.index]!])}
                      >
                        {row.days[s.index]}
                      </td>
                    ),
                  )}
                  <td className={cell}>{t.working}</td>
                  <td className={cn(cell, "font-bold")}>{t.absent}</td>
                  <td className={cell}>{t.vacation}</td>
                  <td className={cell}>{t.fridaysHolidays}</td>
                  <td className={cell}>{t.monthDays}</td>
                  {saudi ? (
                    <td rowSpan={2} className={cn(cell, "text-[7.5px]")}>
                      {delayLabel(t.extra)}
                    </td>
                  ) : (
                    <>
                      <td rowSpan={2} className={cell}>
                        {t.extra}
                      </td>
                      <td rowSpan={2} className={cell}>
                        {row.foodAllowance === null
                          ? ""
                          : row.foodAllowance.toLocaleString("en-US")}
                      </td>
                    </>
                  )}
                </tr>
                <tr className="h-[15px]">
                  {segments.map((s) => {
                    if (s.kind === "gap") return null;
                    const off = weekendCode(dates[s.index]!, row.weekend);
                    const value = row.extra[s.index];
                    return (
                      <td
                        key={s.index}
                        className={cn(cell, "p-0", off && "bg-neutral-300 font-semibold")}
                      >
                        {value ?? off ?? ""}
                      </td>
                    );
                  })}
                  <td className={cell} colSpan={5} />
                </tr>
              </tbody>
            );
          })}
        </table>
        <div className="mt-2 grid w-1/2 grid-cols-3 gap-x-6 gap-y-0.5 pl-24 text-[9px]">
          <span>P : Present</span>
          <span>V : Vacation</span>
          <span>L : LWOP</span>
          <span>A : Absent</span>
          <span>S : Sick Leave</span>
        </div>
      </div>
    </div>
  );
}
