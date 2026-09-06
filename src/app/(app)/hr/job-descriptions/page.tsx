import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listJobDescriptions } from "@/server/services/hiring";
import { orgOptions } from "@/server/services/org";
import { JobDescriptionDialog } from "./job-description-dialog";
import { JobDescriptionRowActions } from "./job-description-row-actions";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Job Descriptions" };

export default async function JobDescriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("hr.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("hr.manage");

  const [descriptions, options] = await Promise.all([
    listJobDescriptions(ctx, { ...(q ? { q } : {}) }),
    orgOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Job Descriptions"
        description="Reusable role definitions attached to offers. Editing one bumps its version, so an offer that quoted an earlier text stays distinguishable."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="job-description-register" ctx={ctx} />
            {canManage ? (
              <JobDescriptionDialog
                companies={options.companies}
                positions={options.positions}
              />
            ) : null}
          </div>
        }
      />

      <SearchInput placeholder="Search title…" />

      {descriptions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q ? "No matching descriptions" : "No job descriptions"}
          description={
            q ? "Try a different search term." : "Add one to attach it to future offers."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Position</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-right font-medium">Version</th>
                <th className="px-3 py-2 text-right font-medium">Offers</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {descriptions.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{d.title}</p>
                    {d.summary ? (
                      <p className="text-muted-foreground max-w-md truncate text-xs">
                        {d.summary}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {d.position?.title ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {d.company?.code ?? "All"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">v{d.version}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {d._count.jobOffers}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={d.isActive ? "default" : "outline"}>
                      {d.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <JobDescriptionRowActions
                        description={{
                          id: d.id,
                          companyId: d.companyId,
                          positionId: d.positionId,
                          title: d.title,
                          summary: d.summary,
                          responsibilities: d.responsibilities,
                          requirements: d.requirements,
                          isActive: d.isActive,
                          offerCount: d._count.jobOffers,
                        }}
                        companies={options.companies}
                        positions={options.positions}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
