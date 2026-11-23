import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Printer, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { monthLabel as sheetMonthLabel, monthKey, periodDays } from "@/lib/timesheet";
import { listTimesheets } from "@/server/services/timesheet-sheets";
import { deleteTimesheetAction } from "@/server/actions/timesheets";
import { NewTimesheetDialog } from "./new-timesheet-dialog";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  listTimesheetFiles,
  takenTimesheetMonths,
  timesheetYears,
} from "@/server/services/timesheets";
import { orgOptions } from "@/server/services/org";
import { TimesheetFilters } from "./timesheet-filters";
import { UploadTimesheet } from "./upload-timesheet";
import { DeleteTimesheet } from "./timesheet-row-actions";

export const metadata: Metadata = { title: "Timesheet" };

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; year?: string }>;
}) {
  const ctx = await requirePagePermission("hr.timesheet.view");
  const params = await searchParams;
  // Upload also goes through the document uploader, which has its own gate.
  const canManage = ctx.permissions.has("hr.timesheet.manage");
  const canUpload = canManage && ctx.permissions.has("documents.upload");
  const canDownload = ctx.permissions.has("documents.download");

  const year = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : undefined;
  const [sheets, files, years, options, taken] = await Promise.all([
    listTimesheets(ctx),
    listTimesheetFiles(ctx, { companyId: params.company, year }),
    timesheetYears(ctx),
    orgOptions(ctx),
    canUpload ? takenTimesheetMonths(ctx) : Promise.resolve([]),
  ]);
  const filtered = Boolean(params.company || year);

  return (
    <PageShell>
      <PageHeader
        title="Timesheet"
        description="Monthly attendance, 16th to 15th. Mark each day, print the sheet for signatures, then upload the signed copy against it."
        action={canManage ? <NewTimesheetDialog companies={options.companies} /> : null}
      />

      {sheets.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="No timesheets yet"
          description="Create one for a month: everyone employed in the period is added."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 text-left font-medium">Sheet</th>
                <th className="px-3 py-2 text-right font-medium">Employees</th>
                <th className="px-3 py-2 text-left font-medium">Signed copy</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sheets.map((t) => {
                const key = monthKey(t.month);
                const days = periodDays(key);
                return (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <p className="font-medium">{sheetMonthLabel(key)}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {days[0]!.toISOString().slice(5, 10)} →{" "}
                        {days[days.length - 1]!.toISOString().slice(5, 10)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/people/timesheet/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {t.group === "SAUDI"
                          ? "Saudi"
                          : t.group === "ALL"
                            ? "Everyone"
                            : "Non-Saudi"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{t._count.entries}</td>
                    <td className="px-3 py-2">
                      {t.signedFileId ? (
                        canDownload ? (
                          <a href={`/api/files/${t.signedFileId}`} className="hover:underline">
                            {t.signedFile?.originalName ?? "Signed copy"}
                          </a>
                        ) : (
                          <Badge variant="default">Signed</Badge>
                        )
                      ) : (
                        <Badge variant="outline">Not uploaded</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/people/timesheet/${t.id}/print`}>
                            <Printer />
                            Print
                          </Link>
                        </Button>
                        {canManage ? (
                          <DeleteRecordButton
                            id={t.id}
                            label={`timesheet ${t.title} ${sheetMonthLabel(key)}`}
                            action={deleteTimesheetAction}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-2 pt-4">
        <div>
          <h2 className="text-sm font-semibold">Other uploaded timesheet files</h2>
          <p className="text-muted-foreground text-xs">
            Excel or PDF timesheets uploaded on their own, one per company per month.
          </p>
        </div>
        {canUpload ? <UploadTimesheet companies={options.companies} taken={taken} /> : null}
      </div>

      <TimesheetFilters companies={options.companies} years={years} />

      {files.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={filtered ? "No timesheets match" : "No timesheets yet"}
          description={
            filtered
              ? "Try a different company or year."
              : "Upload the Excel timesheet for a company and month."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">File</th>
                <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {files.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{t.monthLabel}</td>
                  <td className="px-3 py-2">
                    <p>{t.company.code}</p>
                    <p className="text-muted-foreground text-xs">{t.company.name}</p>
                  </td>
                  <td className="px-3 py-2">
                    {canDownload ? (
                      <a href={`/api/files/${t.file.id}`} className="hover:underline">
                        {t.file.originalName}
                      </a>
                    ) : (
                      t.file.originalName
                    )}
                    <p className="text-muted-foreground text-xs">{fileSize(t.file.sizeBytes)}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p>{t.uploadedBy}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {t.uploadedAt.toISOString().slice(0, 10)}
                    </p>
                  </td>
                  <td className="text-muted-foreground max-w-xs px-3 py-2">{t.notes ?? ""}</td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <DeleteTimesheet id={t.id} label={`${t.company.code} ${t.monthLabel}`} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {files.length} {files.length === 1 ? "file" : "files"}
      </p>
    </PageShell>
  );
}
