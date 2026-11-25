import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { recordAudit } from "@/server/audit/log";
import { safeFilename } from "@/lib/export";
import type { ReportColumnSpec } from "@/lib/reports";
import { DAILY_TASK_STATUS_LABELS, readTaskFilters } from "@/lib/schemas/tasks";
import { listDailyTasks } from "@/server/services/daily-tasks";
import { buildWorkbook } from "@/server/export/workbook";

export const runtime = "nodejs";

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear())}`;

const COLUMNS: ReportColumnSpec[] = [
  { key: "no", header: "No." },
  { key: "date", header: "Date" },
  { key: "task", header: "Task" },
  { key: "from", header: "Received From" },
  { key: "remarks", header: "Remarks" },
  { key: "status", header: "Status" },
  { key: "completed", header: "Completed On" },
];

/** The user's own task list as Excel, with the filters on screen. */
export async function GET(request: NextRequest) {
  const ctx = await getActorContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!ctx.permissions.has("dashboard.view")) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  try {
    await consumeRateLimit("reportExport", ctx.userId);
  } catch {
    return NextResponse.json({ error: "Too many exports. Try again later." }, { status: 429 });
  }

  const url = new URL(request.url);
  const filters = readTaskFilters(Object.fromEntries(url.searchParams));
  // The list shows newest first; on paper, oldest first reads as a log.
  const tasks = (await listDailyTasks(ctx, filters)).reverse();
  const done = tasks.filter((t) => t.status === "COMPLETED").length;

  const rows = tasks.map((t, i) => ({
    no: i + 1,
    date: dmy(t.taskDate),
    task: t.description,
    from: t.receivedFrom,
    remarks: t.remarks ?? "",
    status: DAILY_TASK_STATUS_LABELS[t.status],
    completed: t.completedAt ? dmy(t.completedAt) : "",
  }));

  const period =
    filters.from || filters.to ? `${filters.from ?? "start"} to ${filters.to ?? "today"}` : "All dates";
  const now = new Date();
  const workbook = await buildWorkbook("Daily Tasks", COLUMNS, rows, {
    generatedAt: now,
    generatedBy: ctx.name,
    filters: `${period} · ${String(tasks.length)} tasks · ${String(done)} completed · ${String(tasks.length - done)} pending${
      filters.status ? ` · ${DAILY_TASK_STATUS_LABELS[filters.status]} only` : ""
    }`,
  });

  await recordAudit(ctx, {
    action: "EXPORT",
    entityType: "TASK",
    entityId: "DAILY_TASKS",
    summary: `Exported daily tasks — ${String(tasks.length)} rows`,
  });

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(`Daily Tasks ${now.toISOString().slice(0, 10)}`, "xlsx")}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
