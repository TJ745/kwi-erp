import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { logger } from "@/server/logger";
import type { SalaryImportResponse } from "@/lib/salary-import";
import { ImportFileError } from "@/server/import/employee-workbook";
import { parseSalaryWorkbook } from "@/server/import/salary-workbook";
import { commitSalaryImport, previewSalaryImport } from "@/server/services/salary-import";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Bulk salary update — preview, then commit, the same file sent twice. The
 * server keeps nothing in between, so what was previewed is what is saved.
 */
export async function POST(request: NextRequest) {
  const ctx = await getActorContext();
  if (!ctx) return deny(401, "Not signed in.");
  if (
    !ctx.permissions.has("employees.salary.view") ||
    !ctx.permissions.has("employees.salary.manage")
  ) {
    return deny(404, "Not found.");
  }

  try {
    await consumeRateLimit("employeeImport", ctx.userId);
  } catch {
    return deny(429, "Too many upload attempts. Please try again later.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return deny(400, "Expected a file upload.");
  }
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  const file = form.get("file");
  if (!(file instanceof File)) return deny(400, "Choose an .xlsx file.");
  if (file.size === 0) return deny(400, "The file is empty.");
  if (file.size > MAX_FILE_BYTES) return deny(400, "The file is larger than 5 MB.");

  try {
    const rows = await parseSalaryWorkbook(Buffer.from(await file.arrayBuffer()));
    if (mode === "preview") {
      const preview = await previewSalaryImport(ctx, rows);
      return NextResponse.json({ ok: true, mode, preview } satisfies SalaryImportResponse);
    }
    const result = await commitSalaryImport(ctx, rows);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `${String(result.preview.errorCount)} row(s) have errors. Nothing was saved.`,
          preview: result.preview,
        } satisfies SalaryImportResponse,
        { status: 409 },
      );
    }
    revalidatePath("/people/employees");
    logger.info("Salaries updated from spreadsheet", {
      userId: ctx.userId,
      updated: result.updated,
    });
    return NextResponse.json({
      ok: true,
      mode,
      updated: result.updated,
    } satisfies SalaryImportResponse);
  } catch (error) {
    if (error instanceof ImportFileError) return deny(400, error.message);
    const reference = crypto.randomUUID().slice(0, 8);
    logger.error("Salary import failed", {
      reference,
      mode,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    });
    return deny(500, `Upload failed. Reference ${reference}.`);
  }
}

function deny(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message } satisfies SalaryImportResponse, {
    status,
  });
}
