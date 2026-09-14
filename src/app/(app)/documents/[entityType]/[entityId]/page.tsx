import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { DocumentsPanel } from "@/components/shared/documents-panel";
import {
  UPLOAD_ENTITY_LABELS,
  UPLOAD_ENTITY_TYPES,
  type UploadEntityType,
} from "@/lib/upload-entities";
import { requirePagePermission } from "@/server/auth/page-guards";
import { resolveDocumentSubject } from "@/server/services/documents";

export const metadata: Metadata = { title: "Documents" };

/**
 * The document library for any record, at one address.
 *
 * Most modules are list-only — there is no supplier or bill detail page to
 * host an upload panel, and building eleven detail pages to carry one card
 * each would be a lot of surface for very little. This route gives every
 * record a documents page reachable from its row.
 *
 * The entity type comes from the URL, so it is validated against
 * UPLOAD_ENTITY_TYPES before anything touches the database: an unrecognised
 * value must not reach a query, and a recognised one still has to pass the
 * per-entity scope check inside resolveDocumentSubject.
 */
export default async function EntityDocumentsPage({
  params,
}: {
  params: Promise<{ entityType: string; entityId: string }>;
}) {
  const ctx = await requirePagePermission("documents.view");
  const { entityType, entityId } = await params;

  if (!(UPLOAD_ENTITY_TYPES as readonly string[]).includes(entityType)) notFound();
  const typed = entityType as UploadEntityType;

  // Null covers "no such record" and "outside your companies" alike — the
  // caller cannot tell which, so ids cannot be probed.
  const subject = await resolveDocumentSubject(ctx, typed, entityId);
  if (!subject) notFound();

  return (
    <PageShell>
      <PageHeader
        title={subject.label}
        description={`Documents held against this ${UPLOAD_ENTITY_LABELS[typed].toLowerCase()}.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={subject.backHref}>
              <ArrowLeft />
              Back
            </Link>
          </Button>
        }
      />

      <DocumentsPanel
        ctx={ctx}
        entityType={typed}
        entityId={entityId}
        companyId={subject.companyId}
        defaultTitle={`${subject.label} — `}
      />
    </PageShell>
  );
}
