import type { Metadata } from "next";
import Link from "next/link";
import { FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  documentCounts,
  listAllDocuments,
  listDocumentTypes,
} from "@/server/services/platform";

export const metadata: Metadata = { title: "Documents" };

/** Where an entity's own record lives, so a row can link back to it. */
function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "EMPLOYEE":
      return `/people/employees/${entityId}`;
    case "VEHICLE":
      return `/vehicles/${entityId}`;
    case "IT_ASSET":
      return `/it/assets/${entityId}`;
    default:
      return null;
  }
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ typeId?: string; entityType?: string; q?: string; expiring?: string }>;
}) {
  const ctx = await requirePagePermission("documents.view");
  const params = await searchParams;
  const canDownload = ctx.permissions.has("documents.download");
  const expiringOnly = params.expiring === "1";

  const [documents, types, counts] = await Promise.all([
    listAllDocuments(ctx, {
      ...(params.typeId ? { typeId: params.typeId } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.q ? { q: params.q } : {}),
      ...(expiringOnly ? { expiringOnly: true } : {}),
    }),
    listDocumentTypes(),
    documentCounts(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Documents"
        description="Every governed document across the companies you can see. The per-record tabs answer what one employee holds; this answers what is about to lapse."
      />

      <div className="grid grid-cols-3 gap-3" data-print-hide>
        <StatCard label="Documents held" value={counts.total} href="/documents" />
        <StatCard
          label="Expiring in 60 days"
          value={counts.expiring}
          tone="warning"
          href="/documents?expiring=1"
        />
        <StatCard label="Expired" value={counts.expired} tone="expired" href="/documents?expiring=1" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search title or document number…" />
        {expiringOnly ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/documents">Show all</Link>
          </Button>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={params.q || expiringOnly ? "No matching documents" : "No documents"}
          description={
            params.q || expiringOnly
              ? "Try a different filter."
              : "Documents uploaded against employees, vehicles, and assets appear here."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Attached to</th>
                <th className="px-3 py-2 text-left font-medium">Number</th>
                <th className="px-3 py-2 text-left font-medium">Expiry</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                {canDownload ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const href = entityHref(d.entityType, d.entityId);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{d.title}</p>
                      {d.version > 1 ? (
                        <p className="text-muted-foreground text-xs">
                          version {d.version}
                          {d.supersedesId ? " · renewal" : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {d.documentType.name}
                    </td>
                    <td className="px-3 py-2">
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {d.entityType.replace(/_/g, " ").toLowerCase()}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {d.entityType.replace(/_/g, " ").toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{d.documentNo ?? "—"}</td>
                    <td className="px-3 py-2">
                      {d.expiryDate ? (
                        <>
                          <span className="tabular-nums">
                            {d.expiryDate.toISOString().slice(0, 10)}
                          </span>
                          <ExpiryAlert date={d.expiryDate} className="mt-0.5" />
                        </>
                      ) : (
                        <span className="text-muted-foreground">No expiry</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{d.company.code}</td>
                    {canDownload ? (
                      <td className="px-3 py-2">
                        {/* The only route to a stored file — it authorises,
                            then streams (SECURITY.md §6.4). */}
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/api/files/${d.fileId}`}>Open</a>
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {types.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {types.length} document type{types.length === 1 ? "" : "s"} configured ·{" "}
          <Link href="/settings/document-types" className="hover:underline">
            manage types
          </Link>
        </p>
      ) : null}
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "warning" | "expired";
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-foreground/20 gap-0 py-4 transition-colors">
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              value > 0 && tone === "warning" && "text-status-warning",
              value > 0 && tone === "expired" && "text-status-expired",
            )}
          >
            {value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
