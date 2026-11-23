import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { LETTER_TYPE_LABELS } from "@/lib/schemas/letters";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listTemplates } from "@/server/services/letters";
import { DeleteTemplateButton } from "./delete-template-button";

export const metadata: Metadata = { title: "Letter Templates" };

/**
 * The editor lives on its own page rather than in a dialog: a body can be 50 KB
 * of HTML, and shipping every template's body to the list just to support an
 * inline edit would be wasteful.
 */
export default async function LetterTemplatesPage() {
  const ctx = await requirePagePermission("letters.manageTemplates");
  const templates = await listTemplates(ctx);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Letter Templates"
        description="Bodies are HTML with {{placeholders}}. A template with no company is shared by every company."
        action={
          <Button asChild size="sm">
            <Link href="/settings/templates/new">
              <Plus />
              New template
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates"
          description="Add a template to start generating letters."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-right font-medium">Version</th>
                <th className="px-3 py-2 text-right font-medium">Generated</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/settings/templates/${template.id}`}
                      className="font-medium hover:underline"
                    >
                      {template.name}
                    </Link>
                    <p className="text-muted-foreground font-mono text-xs">{template.key}</p>
                  </td>
                  <td className="px-3 py-2">{LETTER_TYPE_LABELS[template.type]}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {template.company?.code ?? "All companies"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">v{template.version}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {template._count.generated}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={template.isActive ? "default" : "outline"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <DeleteTemplateButton id={template.id} name={template.name} />
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
