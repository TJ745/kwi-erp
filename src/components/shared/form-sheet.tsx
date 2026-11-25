import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PrintPageButton } from "./print-page-button";

export type SheetCompany = {
  id: string;
  name: string;
  headerImageFileId: string | null;
  footerImageFileId?: string | null;
};

/**
 * A one-page company form (PRR, interview report, joining letter, clearance
 * form) on the company's letterhead, printed through the browser (ADR-004).
 * The form's own code (e.g. FM:AP:002) sits at the bottom right, as on paper.
 */
export function FormSheet({
  backHref,
  backLabel,
  title,
  subtitle,
  company,
  code,
  className,
  bordered,
  letterhead = true,
  footer = false,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string | undefined;
  company: SheetCompany;
  code?: readonly string[] | undefined;
  className?: string | undefined;
  /** The blue double border of the joining letter. */
  bordered?: boolean | undefined;
  /** False for forms printed without the company letterhead. */
  letterhead?: boolean | undefined;
  /** Repeat the company's footer artwork at the bottom of the page. */
  footer?: boolean | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="letter-sheet--form mx-auto w-full max-w-4xl space-y-6 p-6 print:space-y-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={backHref}>
              <ArrowLeft />
              {backLabel}
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
          </div>
        </div>
        <PrintPageButton />
      </div>

      <article className="letter-sheet doc-paper rounded-lg border p-8 print:rounded-none print:border-0 print:bg-white print:p-0">
        <table className={cn("letter-frame", bordered && "form-bordered")}>
          <thead className="letter-head-group">
            <tr>
              <td>
                <div className="letter-head form-logo">
                  {!letterhead ? null : company.headerImageFileId !== null ? (
                    // Served from a session-gated route, out of next/image's reach.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${company.id}/branding/header`}
                      alt={`${company.name} letterhead`}
                      className="w-full object-contain"
                    />
                  ) : (
                    <p className="border-b pb-2 text-center text-lg font-semibold">
                      {company.name}
                    </p>
                  )}
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className={cn("form-sheet text-black", className)}>{children}</div>
                {code ? (
                  <div className="mt-1 text-right text-[9px] leading-tight text-neutral-600">
                    {code.map((c) => (
                      <p key={c}>{c}</p>
                    ))}
                  </div>
                ) : null}
              </td>
            </tr>
          </tbody>
          {footer && company.footerImageFileId ? (
            <tfoot className="letter-foot-group">
              <tr>
                <td>
                  <div className="letter-foot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/companies/${company.id}/branding/footer`}
                      alt=""
                      className="w-full object-contain"
                    />
                  </div>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </article>
    </div>
  );
}

/** A printed tick box: ✓ when checked, or ✕ with `mark="x"` (as some forms print it). */
export function Tick({
  on,
  label,
  mark = "check",
}: {
  on: boolean;
  label?: React.ReactNode;
  mark?: "check" | "x";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className="inline-flex size-[13px] shrink-0 items-center justify-center border border-black text-[11px] leading-none font-bold">
        {on ? (mark === "x" ? "✕" : "✓") : ""}
      </span>
      {label !== undefined ? <span>{label}</span> : null}
    </span>
  );
}
