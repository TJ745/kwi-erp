import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { isFormLetter, LETTER_TYPE_LABELS } from "@/lib/schemas/letters";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getGeneratedLetter } from "@/server/services/letters";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Letter" };

/**
 * The print path (ADR-004): the browser renders the letter and the user prints
 * to PDF. Arabic shaping and bidi come out perfect because it is the same text
 * engine that displays the page, and it costs nothing to run.
 */
export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("letters.view");
  const { id } = await params;

  const letter = await getGeneratedLetter(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  // The named page goes on the OUTERMOST printable container, not on the sheet.
  // `page:` switches page context, and a switch partway down the tree makes the
  // browser lay out the ancestors on the default page and the sheet on the
  // named one — which emitted two blank pages after the form.
  const isForm = isFormLetter(letter.template.type);

  return (
    <div
      // print:p-0 / print:space-y-0 matter: the wrapper's padding and the
      // space-y gap above the sheet survive into print, and a quarter inch
      // past the bottom of a full page emits an entirely blank extra sheet.
      className={`mx-auto w-full max-w-4xl space-y-6 p-6 print:space-y-0 print:p-0${
        isForm ? "letter-sheet--form" : ""
      }`}
    >
      {/* Screen-only chrome; the print stylesheet hides it. */}
      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/hr/letters">
                <ArrowLeft />
                All letters
              </Link>
            </Button>
            <div>
              <h1 className="font-mono text-lg font-semibold">{letter.letterNo}</h1>
              <p className="text-muted-foreground text-xs">
                {LETTER_TYPE_LABELS[letter.template.type]} · {letter.template.name} · generated{" "}
                {letter.generatedAt.toISOString().slice(0, 10)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={letter.status === "CANCELLED" ? "destructive" : "outline"}>
              {letter.status}
            </Badge>
            <PrintButton />
          </div>
        </div>

        {letter.status === "CANCELLED" ? (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive mt-4 rounded-md border p-3 text-sm"
          >
            This letter has been cancelled. It is kept for the audit trail and should not be issued.
          </p>
        ) : null}
      </div>

      {/*
        Forms print on their own page setup — tighter margins and a smaller
        letterhead reserve, so a dense grid fits the single sheet it has to fit
        (see isFormLetter). Letters keep the roomier default.
      */}
      <article className="letter-sheet bg-background rounded-lg border p-10 print:rounded-none print:border-0 print:p-0">
        {/*
          A table, and not for layout fashion — it is the only construct
          browsers repeat across printed pages. `thead` and `tfoot` are drawn
          on EVERY page of a multi-page letter and, crucially, reserve their
          height on every page. `position: fixed` also repeats, but padding on
          a flowing block only applies to its first and last fragment, so the
          body would run underneath the letterhead on pages 2..n.

          Letterhead is page chrome, not letter content. It lives here rather
          than inside the template body on purpose: the body is sanitised and
          the sanitiser forbids <img> (src/lib/templates.ts), and it should stay
          that way. Artwork set once in company settings also means a template
          does not carry a copy of the branding that goes stale when it changes.
        */}
        <table className="letter-frame">
          <thead className="letter-head-group">
            <tr>
              <td>
                <div className="letter-head">
                  {letter.company.headerImageFileId !== null ? (
                    // Served from a session-gated route that streams the bytes,
                    // so next/image's optimiser cannot reach it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${letter.company.id}/branding/header`}
                      alt={`${letter.company.name} letterhead`}
                      className="w-full object-contain"
                    />
                  ) : (
                    <div>
                      <p className="text-lg font-semibold">{letter.company.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {[letter.company.addressLine, letter.company.city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="text-muted-foreground mt-3 flex justify-between border-t pt-3 text-xs">
                    <span className="font-mono">{letter.letterNo}</span>
                    <span>{letter.generatedAt.toISOString().slice(0, 10)}</span>
                  </div>
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                {/*
                  Sanitised on save and again at render (src/lib/templates.ts),
                  with all substituted values HTML-escaped. This is the only
                  place letter HTML is injected.
                */}
                <div
                  className="letter-body"
                  dangerouslySetInnerHTML={{ __html: letter.renderedHtml }}
                />
              </td>
            </tr>
          </tbody>

          <tfoot className="letter-foot-group">
            <tr>
              <td>
                <div className="letter-foot">
                  {letter.company.footerImageFileId !== null ? (
                    // As above.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${letter.company.id}/branding/footer`}
                      alt=""
                      className="w-full object-contain"
                    />
                  ) : (
                    <CompanyFootline company={letter.company} />
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

/**
 * The typed footer used when a company has no footer artwork.
 *
 * Registration and VAT numbers belong on an issued letter — a Saudi recipient
 * checks them — so the absence of an image should not mean the absence of the
 * details.
 */
function CompanyFootline({
  company,
}: {
  company: {
    addressLine: string | null;
    city: string | null;
    country: string;
    crNumber: string | null;
    vatNumber: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
}) {
  const address = [company.addressLine, company.city, company.country].filter(Boolean).join(", ");
  const registrations = [
    company.crNumber ? `CR ${company.crNumber}` : null,
    company.vatNumber ? `VAT ${company.vatNumber}` : null,
  ].filter(Boolean);
  const contact = [company.phone, company.email, company.website].filter(Boolean);

  if (!address && registrations.length === 0 && contact.length === 0) return null;

  return (
    <div className="text-muted-foreground border-t pt-3 text-center text-[11px] leading-relaxed">
      {address ? <p>{address}</p> : null}
      {registrations.length > 0 ? <p>{registrations.join(" · ")}</p> : null}
      {contact.length > 0 ? <p>{contact.join(" · ")}</p> : null}
    </div>
  );
}
