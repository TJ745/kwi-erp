import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listChecklistTemplates } from "@/server/services/platform";
import { DeleteTemplateButton } from "./delete-template-button";

export const metadata: Metadata = { title: "Checklist Templates" };

export default async function ChecklistTemplatesPage() {
  const ctx = await requirePagePermission("settings.manage");
  const templates = await listChecklistTemplates(ctx);

  return (
    <PageShell>
      <PageHeader
        title="Checklist Templates"
        description="The steps an onboarding, offboarding, or clearance runs through. Editing a template never changes a checklist already in progress — those keep their own copy."
        action={
          <Button asChild size="sm">
            <Link href="/settings/checklists/new">New template</Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No checklist templates"
          description="Create one to drive onboarding and offboarding."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-right font-medium">Steps</th>
                <th className="px-3 py-2 text-right font-medium">Used</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/settings/checklists/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                    <p className="text-muted-foreground font-mono text-xs">{t.key}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{t.type}</Badge>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {t.company?.code ?? "All companies"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t._count.items}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {t._count.instances}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={t.isActive ? "default" : "outline"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <DeleteTemplateButton
                      id={t.id}
                      name={t.name}
                      instances={t._count.instances}
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
