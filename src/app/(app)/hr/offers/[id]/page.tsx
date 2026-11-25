import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { ID_TYPE_LABELS, offerClauses, offerDateLabel, SALARY_LINES } from "@/lib/job-offer";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getJobOfferForPrint } from "@/server/services/hiring";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Employment offer" };

const money = (v: { toString(): string }) =>
  Number(v.toString()).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** The printed employment offer, after the company's letter (ADR-004 print path). */
export default async function OfferLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.offers.view");
  // The letter states the salary.
  if (!ctx.permissions.has("employees.salary.view")) redirect("/hr/offers");
  const { id } = await params;

  const o = await getJobOfferForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const company = o.company;

  const salaryRows = SALARY_LINES.filter((l) => o[l.key] !== null).map((l) => ({
    label: l.label,
    amount: o[l.key]!,
  }));
  const clauses = offerClauses({
    companyCode: company.code,
    contractYears: o.contractYears,
    probationDays: o.probationDays,
    familyStatus: o.familyStatus,
    leavePlan: o.leavePlan,
    ticketCover: o.ticketCover,
    ticketDestination: o.ticketDestination,
    medicalCover: o.medicalCover,
  });
  // 01 is the position, then one number per salary line, then the clauses.
  let n = 1;
  const num = () => `${String(n++).padStart(2, "0")}.`;

  const header: [string, string | null][] = [
    ["Date:", offerDateLabel(o.offerDate ?? o.createdAt)],
    ["Mobile #", o.candidatePhone],
    ["Email", o.candidateEmail],
    [
      o.candidateIdType ? ID_TYPE_LABELS[o.candidateIdType as "PASSPORT" | "IQAMA"] : "Passport #",
      o.candidateIdNumber,
    ],
    ["Address :", o.candidateAddress],
  ];

  return (
    <div className="letter-sheet--form mx-auto w-full max-w-4xl space-y-6 p-6 print:space-y-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hr/offers">
            <ArrowLeft />
            All offers
          </Link>
        </Button>
        <PrintButton />
      </div>

      <article className="letter-sheet offer-sheet doc-paper rounded-lg border bg-white p-10 text-black print:rounded-none print:border-0 print:p-0">
        <table className="letter-frame">
          <thead className="letter-head-group">
            <tr>
              <td>
                <div className="letter-head">
                  {company.headerImageFileId !== null ? (
                    // Session-gated route; next/image cannot fetch it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${company.id}/branding/header`}
                      alt={`${company.name} letterhead`}
                      className="w-full object-contain"
                    />
                  ) : (
                    <p className="text-center text-lg font-semibold">{company.name}</p>
                  )}
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <div className="text-[12.5px] leading-[1.35]">
                  <div className="flex items-end justify-between">
                    <p className="pl-8 font-bold">Our Ref.: {o.refNo ?? ""}</p>
                    <table className="mr-6">
                      <tbody>
                        {header.map(([label, value]) => (
                          <tr key={label}>
                            <td className="pr-6 font-bold">{label}</td>
                            <td>{value ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h1 className="mt-1 text-center text-[14px] font-bold underline underline-offset-2">
                    EMPLOYMENT OFFER
                  </h1>

                  <p className="mt-3">
                    <strong>To:</strong> {o.salutation} {o.candidateName}
                  </p>
                  <p className="mt-1">
                    Further to your interest in joining our company, we would like to offer you the
                    following position based on terms and conditions herein:
                  </p>

                  <table className="offer-terms mt-1 w-full">
                    <colgroup>
                      <col className="w-[1.9rem]" />
                      <col className="w-[10.5rem]" />
                      <col className="w-[1rem]" />
                      <col />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td>{num()}</td>
                        <td className="font-bold italic">Position</td>
                        <td>:</td>
                        <td className="offer-sans italic">{o.position?.title ?? ""}</td>
                      </tr>
                      {salaryRows.map((r, i) => (
                        <tr key={r.label}>
                          <td>{num()}</td>
                          <td className="font-bold italic">{r.label}</td>
                          <td>:</td>
                          <td>
                            <SalaryCells
                              currency={o.currency}
                              amount={money(r.amount)}
                              underline={i === salaryRows.length - 1}
                            />
                          </td>
                        </tr>
                      ))}
                      {o.proposedSalary !== null ? (
                        <tr>
                          <td />
                          <td className="font-bold italic">Total Package</td>
                          <td>:</td>
                          <td>
                            <SalaryCells currency={o.currency} amount={money(o.proposedSalary)} />
                          </td>
                        </tr>
                      ) : null}
                      {clauses.map((c) => (
                        <tr key={c.label}>
                          <td>{num()}</td>
                          <td className="font-bold italic">{c.label}</td>
                          <td>:</td>
                          <td>
                            {c.lines.map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="mt-4">
                    Kindly sign the duplicate copy of this letter accepting all the terms and
                    conditions mentioned herein.
                  </p>

                  <table className="offer-box offer-sans mt-1 w-full">
                    <tbody>
                      <tr>
                        <td colSpan={2} className="text-[14px] font-bold">
                          Employee Offer Acceptance
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="text-[11.5px]">
                          <p>I Confirm having accepted the above offer</p>
                          <p className="mt-1 italic">Name:</p>
                          <p className="mt-1 flex italic">
                            <span className="w-1/2">Date:</span>
                            <span>Signature:</span>
                          </p>
                        </td>
                      </tr>
                      <tr className="h-[26mm] align-top">
                        <td className="w-1/2 font-bold">
                          <span className="flex h-[24mm] flex-col justify-between">
                            <span className="text-[14px]">Approved by:</span>
                            <span className="text-[14px]">General Manager</span>
                          </span>
                        </td>
                        <td className="font-bold">
                          <span className="flex h-[24mm] flex-col justify-between">
                            <span className="text-[14px]">Verified by:</span>
                            <span className="text-[14px]">HR Manager</span>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>

          <tfoot className="letter-foot-group">
            <tr>
              <td>
                <div className="letter-foot">
                  {company.footerImageFileId !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${company.id}/branding/footer`}
                      alt=""
                      className="w-full object-contain"
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}

/** "SAR   9,480  /  Month", with the line above the total on the last part. */
function SalaryCells({
  currency,
  amount,
  underline = false,
}: {
  currency: string;
  amount: string;
  underline?: boolean;
}) {
  return (
    <span
      className={`grid w-[16rem] grid-cols-[3rem_6rem_2rem_4rem] ${underline ? "border-b border-black" : ""}`}
    >
      <span className="offer-sans italic">{currency}</span>
      <span className="offer-sans text-right italic">{amount}</span>
      <span className="text-center italic">/</span>
      <span className="italic">Month</span>
    </span>
  );
}
