import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getTemplate } from "@/server/services/letters";
import { orgOptions } from "@/server/services/org";
import { AppError } from "@/lib/result";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Letter Template" };

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("letters.manageTemplates");
  const { id } = await params;

  const options = await orgOptions(ctx);
  const isNew = id === "new";

  // A NotFoundError from the service means "no such row, or not in your scope";
  // both should look identical to the caller.
  const template = isNew
    ? null
    : await getTemplate(ctx, id).catch((error: unknown) => {
        if (error instanceof AppError) notFound();
        throw error;
      });

  return (
    <PageShell>
      <PageHeader
        title={template ? template.name : "New letter template"}
        description={
          template
            ? `Version ${String(template.version)}. Saving publishes a new version; existing letters keep their frozen copy.`
            : "Write the body as HTML and reference employee data with {{placeholders}}."
        }
      />
      <TemplateForm
        companies={options.companies}
        {...(template
          ? {
              template: {
                id: template.id,
                key: template.key,
                name: template.name,
                type: template.type,
                companyId: template.companyId,
                bodyHtml: template.bodyHtml,
                bodyHtmlAr: template.bodyHtmlAr,
                isActive: template.isActive,
              },
            }
          : {})}
      />
    </PageShell>
  );
}
