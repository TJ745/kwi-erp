import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { RATE_UNIT_LABELS, splitTerms } from "@/lib/schemas/vendors";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getSubcontractorContractForPrint } from "@/server/services/vendors";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Sub-contract agreement" };

const COUNTRY_NAMES: Record<string, string> = {
  SA: "Kingdom of Saudi Arabia",
  AE: "United Arab Emirates",
  BH: "Kingdom of Bahrain",
  KW: "State of Kuwait",
  OM: "Sultanate of Oman",
  QA: "State of Qatar",
};

/** Dates are stored as UTC midnight; read them back the same way. */
function dmy(date: Date, separator: string): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return [d, m, String(date.getUTCFullYear())].join(separator);
}

/** "SAR. 12/-" for whole amounts, "SAR. 12.50" otherwise, as on the paper form. */
function money(currency: string, amount: string): string {
  const [whole, fraction] = amount.split(".");
  const showFraction = fraction !== undefined && Number(fraction) !== 0;
  return showFraction
    ? `${currency}. ${whole ?? amount}.${fraction}`
    : `${currency}. ${whole ?? amount}/-`;
}

/**
 * The printable sub-contract agreement. Same print path as letters (ADR-004):
 * the browser lays it out and the user prints or saves to PDF, with the
 * company's letterhead repeated on every page by the letter frame.
 */
export default async function SubcontractAgreementPage({
  params,
}: {
  params: Promise<{ subcontractorId: string; contractId: string }>;
}) {
  const ctx = await requirePagePermission("subcontractors.view");
  const { subcontractorId, contractId } = await params;

  const contract = await getSubcontractorContractForPrint(ctx, contractId).catch(
    (error: unknown) => {
      if (error instanceof AppError) notFound();
      throw error;
    },
  );
  if (contract.subcontractor.id !== subcontractorId) notFound();

  const { company, subcontractor } = contract;
  const companyAddress = [
    [company.addressLine, company.city].filter(Boolean).join(", "),
    COUNTRY_NAMES[company.country] ?? company.country,
  ].filter((line) => line.length > 0);
  const subcontractorAddress = (subcontractor.address ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const terms = splitTerms(contract.terms);

  // One unit across the schedule reads as the paper form does ("PER HOUR"
  // column, bare amounts). Mixed units name the unit on each row instead.
  const units = new Set(contract.rates.map((r) => r.unit));
  const singleUnit = units.size === 1 ? [...units][0] : undefined;
  const rateHeader = singleUnit ? RATE_UNIT_LABELS[singleUnit].column : "Rate";

  return (
    // The compact page setup letters use for one-page forms: an agreement is
    // signed as a single sheet, and the 1in letter inset pushes the signature
    // block onto a second page once the letterhead is in.
    <div className="letter-sheet--form mx-auto w-full max-w-4xl space-y-6 p-6 print:space-y-0 print:p-0">
      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/subcontractors/${subcontractor.id}`}>
                <ArrowLeft />
                {subcontractor.name}
              </Link>
            </Button>
            <div>
              <h1 className="font-mono text-lg font-semibold">{contract.contractNo}</h1>
              <p className="text-muted-foreground text-xs">Sub-contract agreement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={contract.status === "ACTIVE" ? "default" : "outline"}>
              {contract.status}
            </Badge>
            <PrintButton />
          </div>
        </div>
        {!subcontractor.address ? (
          <p className="text-status-warning mt-3 text-xs">
            This subcontractor has no address, so none prints under the second party. Add it from
            the subcontractor&apos;s Edit button.
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
                      <p className="text-muted-foreground text-xs">{companyAddress.join(", ")}</p>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <div className="subcontract text-[12px] leading-[1.35] font-semibold">
                  <p className="mt-3 text-right font-normal">
                    Date: {dmy(contract.agreementDate ?? contract.createdAt, "/")}
                    <br />
                    <span className="text-[11px]">Ref: {contract.contractNo}</span>
                  </p>

                  <h2 className="mt-1 mb-3 text-center text-base font-bold underline underline-offset-4">
                    SUB-CONTRACT AGREEMENT
                  </h2>

                  <dl className="grid grid-cols-[8rem_1rem_1fr] gap-y-2.5 uppercase">
                    <dt>First party</dt>
                    <dd>:</dd>
                    <dd>
                      {company.name}
                      {companyAddress.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </dd>
                    <dt>Second party</dt>
                    <dd>:</dd>
                    <dd>
                      {subcontractor.name}
                      {subcontractorAddress.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </dd>
                  </dl>

                  <p className="mt-3">
                    Agreed on {dmy(contract.startDate, ".")} execution of agreement between the two
                    Parties mentioned above as follows:
                    <br />
                    {contract.scope
                      ? `The Second Party undertakes, ${contract.scope} (hereinafter referred to as the “Sub-Contract Works”) as mentioned below schedule.`
                      : "The Second Party undertakes the works (hereinafter referred to as the “Sub-Contract Works”) as mentioned below schedule."}
                  </p>

                  {contract.rates.length > 0 ? (
                    <>
                      <p className="mt-3 ml-8">
                        {contract.scope ? `${contract.scope}:` : "Schedule of rates:"}
                      </p>
                      <table className="subcontract-rates mt-1 w-full border-collapse text-center text-[11.5px]">
                        <thead>
                          <tr>
                            <th className="w-24">Sr. No</th>
                            <th>Category</th>
                            <th className="w-36">{rateHeader}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contract.rates.map((r, index) => (
                            <tr key={r.id}>
                              <td>{String(index + 1).padStart(2, "0")}</td>
                              <td>{r.category}</td>
                              <td className="whitespace-nowrap">
                                {money(contract.currency, r.rate.toString())}
                                {singleUnit ? "" : ` ${RATE_UNIT_LABELS[r.unit].suffix}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}

                  {terms.length > 0 ? (
                    <section className="mt-3">
                      <h3 className="font-bold underline underline-offset-2">
                        Terms &amp; Conditions:
                      </h3>
                      <ol className="mt-1 list-decimal pl-10">
                        {terms.map((term, index) => (
                          <li key={index} className="pl-1">
                            {term}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : null}

                  <div className="subcontract-signatures mt-14 grid grid-cols-2 gap-16 text-center uppercase">
                    <div>
                      <div className="mb-2 border-t-2 border-current" />
                      <p>First party</p>
                      <p>{company.name}</p>
                    </div>
                    <div>
                      <div className="mb-2 border-t-2 border-current" />
                      <p>Second party</p>
                      <p>{subcontractor.name}</p>
                    </div>
                  </div>
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
