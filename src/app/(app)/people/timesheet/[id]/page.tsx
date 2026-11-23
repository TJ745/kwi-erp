import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getTimesheet } from "@/server/services/timesheet-sheets";
import { TimesheetGrid } from "./timesheet-grid";

export const metadata: Metadata = { title: "Timesheet" };

export default async function TimesheetSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.timesheet.view");
  const { id } = await params;
  const sheet = await getTimesheet(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  return (
    <TimesheetGrid
      // A fresh grid after every save or added row, so it shows what is stored.
      key={sheet.version}
      sheet={{
        id: sheet.id,
        title: sheet.title,
        monthKey: sheet.monthKey,
        group: sheet.group,
        days: sheet.days,
        signedFileId: sheet.signedFileId,
        signedName: sheet.signedFile?.originalName ?? null,
        uploadCompanyId: sheet.companyIds[0] ?? "",
      }}
      rows={sheet.rows}
      canManage={ctx.permissions.has("hr.timesheet.manage")}
      canUpload={ctx.permissions.has("documents.upload")}
      canDownload={ctx.permissions.has("documents.download")}
    />
  );
}
