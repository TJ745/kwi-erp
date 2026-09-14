import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUpload } from "@/components/forms/document-upload";
import { EmptyState } from "@/components/shared/states";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import type { UploadEntityType } from "@/lib/upload-entities";
import type { ActorContext } from "@/server/auth/context";
import { documentsForEntity, documentTypesFor } from "@/server/services/documents";

/**
 * The document library for one record, as a drop-in panel.
 *
 * One component rather than the employee page's bespoke tab repeated eleven
 * times: the permission checks, the type filtering and the scope-checked
 * fetch are the parts that must not be re-derived per page, because getting
 * any of them subtly wrong on one module is exactly how a document leaks.
 *
 * A Server Component that does its own fetching. Pages pass only what they
 * already hold — which entity, and which company owns it.
 */
export async function DocumentsPanel({
  ctx,
  entityType,
  entityId,
  companyId,
  defaultTitle,
  title = "Documents",
}: {
  ctx: ActorContext;
  entityType: UploadEntityType;
  entityId: string;
  /** The owning company. Stamped on the document so scope holds on read. */
  companyId: string;
  defaultTitle?: string | undefined;
  title?: string;
}) {
  if (!ctx.permissions.has("documents.view")) return null;

  const canUpload = ctx.permissions.has("documents.upload");

  const [documents, types] = await Promise.all([
    documentsForEntity(ctx, entityType, entityId),
    // Only fetched when it can be used, and only the types valid for THIS kind
    // of record — a bill must not offer "Passport".
    canUpload ? documentTypesFor(entityType) : Promise.resolve([]),
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="size-4" />
            {title}
            {documents.length > 0 ? (
              <span className="text-muted-foreground font-normal tabular-nums">
                ({documents.length})
              </span>
            ) : null}
          </CardTitle>
          {canUpload ? (
            <DocumentUpload
              entityType={entityType}
              entityId={entityId}
              companyId={companyId}
              documentTypes={types}
              {...(defaultTitle ? { defaultTitle } : {})}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents"
            description={
              canUpload
                ? "Upload scans and paperwork for this record."
                : "Nothing has been uploaded for this record."
            }
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  {/* The file is reached through /api/files/[id], which checks
                      documents.download on every request — a link here is not
                      a second read path. */}
                  <a
                    href={`/api/files/${d.fileId}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {d.title}
                  </a>
                  <p className="text-muted-foreground truncate text-xs">
                    {d.documentType.name}
                    {d.documentNo ? ` · ${d.documentNo}` : ""}
                    {` · ${d.file.originalName}`}
                  </p>
                </div>
                {d.expiryDate ? <ExpiryDate date={d.expiryDate} /> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
