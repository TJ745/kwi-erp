import type { Metadata } from "next";
import { FileCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listDocumentTypes } from "@/server/services/platform";
import { DocumentTypeControls } from "./document-type-controls";

export const metadata: Metadata = { title: "Document Types" };

export default async function DocumentTypesPage() {
  await requirePagePermission("documents.manageTypes");
  const types = await listDocumentTypes();

  return (
    <PageShell>
      <PageHeader
        printable
        title="Document Types"
        description="What kinds of document exist, which records they attach to, and when to start warning about renewal. System types are seeded and cannot be deleted."
        action={<DocumentTypeControls mode="create" />}
      />

      {types.length === 0 ? (
        <EmptyState
          icon={FileCog}
          title="No document types"
          description="Add a type before uploading documents."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Key</th>
                <th className="px-3 py-2 text-left font-medium">Applies to</th>
                <th className="px-3 py-2 text-left font-medium">Expiry</th>
                <th className="px-3 py-2 text-left font-medium">Warning days</th>
                <th className="px-3 py-2 text-right font-medium">In use</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{t.name}</p>
                    {t.isSystem ? (
                      <Badge variant="outline" className="mt-0.5 text-xs">
                        System
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{t.key}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.appliesTo.map((e) => (
                        <Badge key={e} variant="outline" className="text-xs">
                          {e.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {t.requiresExpiry ? (
                      <Badge variant="default">Required</Badge>
                    ) : (
                      <span className="text-muted-foreground">Optional</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {t.defaultWarningDays.join(", ")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {t._count.documents}
                  </td>
                  <td className="px-3 py-2">
                    <DocumentTypeControls
                      mode="row"
                      values={{
                        id: t.id,
                        key: t.key,
                        name: t.name,
                        appliesTo: t.appliesTo,
                        requiresExpiry: t.requiresExpiry,
                        defaultWarningDays: t.defaultWarningDays.join(", "),
                        isSystem: t.isSystem,
                        inUse: t._count.documents,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
