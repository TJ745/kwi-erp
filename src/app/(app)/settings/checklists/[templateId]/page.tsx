import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getChecklistTemplate } from "@/server/services/platform";
import { orgOptions } from "@/server/services/org";
import { ChecklistTemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Checklist Template" };

export default async function ChecklistTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const ctx = await requirePagePermission("settings.manage");
  const { templateId } = await params;
  const isNew = templateId === "new";

  const options = await orgOptions(ctx);

  const template = isNew
    ? null
    : await getChecklistTemplate(ctx, templateId).catch((error: unknown) => {
        if (error instanceof AppError) notFound();
        throw error;
      });

  return (
    <PageShell>
      <PageHeader
        title={template ? template.name : "New checklist template"}
        description={
          template && template._count.instances > 0
            ? `${String(template._count.instances)} checklist(s) have been started from this template. Editing it will not change any of them — each keeps the steps it was created with.`
            : "Steps run in the order listed. Drag is not needed — reordering is done by moving rows up and down."
        }
      />

      <ChecklistTemplateForm
        companies={options.companies}
        departments={options.departments}
        {...(template
          ? {
              template: {
                id: template.id,
                key: template.key,
                name: template.name,
                type: template.type,
                companyId: template.companyId,
                isActive: template.isActive,
                items: template.items.map((i) => ({
                  label: i.label,
                  category: i.category,
                  requiresAttachment: i.requiresAttachment,
                  requiresDate: i.requiresDate,
                  defaultDueDays: i.defaultDueDays === null ? "" : String(i.defaultDueDays),
                  responsibleDepartmentId: i.responsibleDepartmentId ?? "",
                })),
              },
            }
          : {})}
      />
    </PageShell>
  );
}
