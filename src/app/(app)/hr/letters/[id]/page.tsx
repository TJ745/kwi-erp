import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import { LETTER_TYPE_LABELS } from "@/lib/schemas/letters";
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
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
                {LETTER_TYPE_LABELS[letter.template.type]} · {letter.template.name} ·
                generated {letter.generatedAt.toISOString().slice(0, 10)}
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
            This letter has been cancelled. It is kept for the audit trail and should not be
            issued.
          </p>
        ) : null}
      </div>

      <article className="letter-sheet bg-background rounded-lg border p-10 print:rounded-none print:border-0 print:p-0">
        <header className="mb-8 border-b pb-6">
          <p className="text-lg font-semibold">{letter.company.name}</p>
          <p className="text-muted-foreground text-xs">
            {[letter.company.addressLine, letter.company.city].filter(Boolean).join(", ")}
          </p>
          <div className="text-muted-foreground mt-4 flex justify-between text-xs">
            <span className="font-mono">{letter.letterNo}</span>
            <span>{letter.generatedAt.toISOString().slice(0, 10)}</span>
          </div>
        </header>

        {/*
          Sanitised on save and again at render (src/lib/templates.ts), with all
          substituted values HTML-escaped. This is the only place letter HTML is
          injected.
        */}
        <div
          className="letter-body"
          dangerouslySetInnerHTML={{ __html: letter.renderedHtml }}
        />
      </article>
    </div>
  );
}
