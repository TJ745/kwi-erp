import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { LETTER_TEXT } from "@/lib/warning-letter";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getWarningForPrint } from "@/server/services/hr-records";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Warning letter" };

/** Dates are stored as UTC midnight; read them back the same way. */
function parts(date: Date) {
  return {
    d: String(date.getUTCDate()).padStart(2, "0"),
    m: String(date.getUTCMonth() + 1).padStart(2, "0"),
    y: String(date.getUTCFullYear()),
  };
}

/**
 * The printable warning letter: English on the left, Arabic on the right, row
 * by row, on the company's letterhead. Same print path as letters (ADR-004).
 */
export default async function WarningLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.warnings.view");
  const { id } = await params;

  const warning = await getWarningForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  const { employee } = warning;
  const { company } = employee;
  const female = employee.gender === "FEMALE";
  const en = LETTER_TEXT.en;
  const ar = LETTER_TEXT.ar;
  const date = parts(warning.issuedDate);
  const nameAr = employee.fullNameAr ?? employee.fullName;
  const positionEn = employee.position?.title ?? null;
  const positionAr = employee.position?.titleAr ?? positionEn;
  const companyAr = company.nameAr ?? company.name;
  const project = warning.project ? ` (${warning.project})` : "";
  const missingArabic = [
    employee.fullNameAr ? null : "the employee's Arabic name",
    !positionEn || employee.position?.titleAr ? null : "the position's Arabic title",
    company.nameAr ? null : "the company's Arabic name",
  ].filter(Boolean);

  return (
    // The compact page setup used for one-page forms, so the signature line
    // stays on the same sheet as the letter under a full-size letterhead.
    <div className="letter-sheet--form mx-auto w-full max-w-4xl space-y-6 p-6 print:space-y-0 print:p-0">
      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/hr/warnings">
                <ArrowLeft />
                All warnings
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Warning letter — {employee.fullName}</h1>
              <p className="text-muted-foreground text-xs">
                {warning.reason} · {warning.level.replace(/_/g, " ").toLowerCase()}
              </p>
            </div>
          </div>
          <PrintButton />
        </div>
        {missingArabic.length > 0 ? (
          <p className="text-status-warning mt-3 text-xs">
            No Arabic version of {missingArabic.join(", ")} is recorded, so the English one prints
            on the Arabic side. Add it on the record to fix this.
          </p>
        ) : null}
      </div>

      <article className="letter-sheet bg-background rounded-lg border p-10 print:rounded-none print:border-0 print:bg-white print:p-0">
        <table className="letter-frame">
          <thead className="letter-head-group">
            <tr>
              <td>
                <div className="letter-head">
                  {company.headerImageFileId !== null ? (
                    // Served from a session-gated route that streams the bytes,
                    // so next/image's optimiser cannot reach it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${company.id}/branding/header`}
                      alt={`${company.name} letterhead`}
                      className="w-full object-contain"
                    />
                  ) : (
                    <div className="border-b pb-3">
                      <p className="text-lg font-semibold">{company.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {[company.addressLine, company.city].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <div className="warning-letter grid grid-cols-2 gap-x-12 font-serif text-[13.5px] leading-snug">
                  {/* Date */}
                  <p className="mt-2">
                    {en.date} {date.d}/{date.m}/{date.y}
                  </p>
                  <p dir="rtl" lang="ar" className="warning-ar mt-2">
                    {ar.date}{" "}
                    <bdi dir="ltr">
                      {date.y}/{date.m}/{date.d}
                    </bdi>
                  </p>

                  {/* Addressee */}
                  <div className="mt-4">
                    <p>{en.to}</p>
                    <p>
                      {employee.fullName} ( {employee.employeeNo} )
                    </p>
                    {positionEn ? (
                      <p>
                        {en.position} {positionEn}
                      </p>
                    ) : null}
                    <p>{company.name}</p>
                  </div>
                  <div dir="rtl" lang="ar" className="warning-ar mt-4">
                    <p>{ar.to}</p>
                    <p>
                      {nameAr} ( <bdi dir="ltr">{employee.employeeNo}</bdi> )
                    </p>
                    {positionAr ? (
                      <p>
                        {ar.position} {positionAr}
                      </p>
                    ) : null}
                    <p>{companyAr}</p>
                  </div>

                  {/* Subject */}
                  <p className="mt-4">
                    <strong>{en.subjectLabel}</strong> <u>{en.subject}</u>
                  </p>
                  <p dir="rtl" lang="ar" className="warning-ar mt-4">
                    <strong>{ar.subjectLabel}</strong> <u>{ar.subject}</u>
                  </p>

                  {/* Body */}
                  <div className="mt-4">
                    <p>{en.dear(employee.fullName, female)}</p>
                    <p className="warning-para">
                      {en.opener} {warning.description}
                      {project}
                    </p>
                    <p className="warning-para">{en.formal}</p>
                    <p className="warning-para">{en.encourage}</p>
                  </div>
                  <div dir="rtl" lang="ar" className="warning-ar mt-4">
                    <p>{ar.dear(nameAr, female)}</p>
                    <p className="warning-para">
                      {ar.opener} {warning.descriptionAr ?? ""}
                      {warning.project ? (
                        <>
                          {" "}
                          <bdi dir="ltr">({warning.project})</bdi>
                        </>
                      ) : null}
                    </p>
                    <p className="warning-para">{ar.formal}</p>
                    <p className="warning-para">{ar.encourage}</p>
                  </div>

                  {/* Sign-off */}
                  <div className="mt-7">
                    <p>{en.regards}</p>
                    <p>{en.hr}</p>
                    <p>{company.name}</p>
                  </div>
                  <div dir="rtl" lang="ar" className="warning-ar mt-7">
                    <p>{ar.regards}</p>
                    <p>{ar.hr}</p>
                    <p>{companyAr}</p>
                  </div>

                  {/* Employee signature */}
                  <p className="mt-7">{en.signature}</p>
                  <p dir="rtl" lang="ar" className="warning-ar mt-7">
                    {ar.signature}
                  </p>
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
                  ) : (
                    <CompanyFootline company={company} />
                  )}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}

/** The typed footer used when a company has no footer artwork. */
function CompanyFootline({
  company,
}: {
  company: {
    crNumber: string | null;
    vatNumber: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
}) {
  const registrations = [
    company.crNumber ? `CR ${company.crNumber}` : null,
    company.vatNumber ? `VAT ${company.vatNumber}` : null,
  ].filter(Boolean);
  const contact = [company.phone, company.email, company.website].filter(Boolean);
  if (registrations.length === 0 && contact.length === 0) return null;

  return (
    <div className="text-muted-foreground border-t pt-3 text-center text-[11px] leading-relaxed">
      {registrations.length > 0 ? <p>{registrations.join(" · ")}</p> : null}
      {contact.length > 0 ? <p>{contact.join(" · ")}</p> : null}
    </div>
  );
}
