import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { logger } from "@/server/logger";
import type { ImportResponse } from "@/lib/employee-import";
import { ImportFileError, parseEmployeeWorkbook } from "@/server/import/employee-workbook";
import { commitEmployeeImport, previewEmployeeImport } from "@/server/services/employee-import";

export const runtime = "nodejs";
/** A 1,000-row commit is hundreds of statements; the default budget is too short. */
export const maxDuration = 120;

/** Larger than any real staff list; a template with 1,000 rows is ~100 KB. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Bulk employee import — one endpoint, two modes.
 *
 * A route handler rather than a Server Action because the input is a file.
 * The client sends the same file twice: once with `mode=preview` to see what
 * would happen, then with `mode=commit` to do it. Nothing is staged between
 * the two — the commit re-parses and re-validates the file it is given, so
 * there is no server-side state to expire, and no way to commit rows other
 * than the ones just previewed.
 */
export async function POST(request: NextRequest) {
  const ctx = await getActorContext();
  if (!ctx) return deny(401, "Not signed in.");
  if (!ctx.permissions.has("employees.create")) return deny(404, "Not found.");

  try {
    await consumeRateLimit("employeeImport", ctx.userId);
  } catch {
    return deny(429, "Too many import attempts. Please try again later.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return deny(400, "Expected a file upload.");
  }

  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  const file = form.get("file");
  if (!(file instanceof File)) return deny(400, "Choose an .xlsx file to import.");
  if (file.size === 0) return deny(400, "The file is empty.");
  if (file.size > MAX_FILE_BYTES) return deny(400, "The file is larger than 5 MB.");

  try {
    const rows = await parseEmployeeWorkbook(Buffer.from(await file.arrayBuffer()));

    if (mode === "preview") {
      const preview = await previewEmployeeImport(ctx, rows);
      return NextResponse.json({ ok: true, mode, preview } satisfies ImportResponse);
    }

    const result = await commitEmployeeImport(ctx, rows);
    if (!result.ok) {
      // Refused with the rows, so the screen shows what changed since the
      // preview (a number taken by someone else meanwhile) rather than "no".
      const { errorCount } = result.preview;
      return NextResponse.json(
        {
          ok: false,
          error: `${String(errorCount)} of ${String(rows.length)} rows have errors. Nothing was imported.`,
          preview: result.preview,
        } satisfies ImportResponse,
        { status: 409 },
      );
    }

    revalidatePath("/people/employees");
    logger.info("Employees imported", { userId: ctx.userId, created: result.created });
    return NextResponse.json({ ok: true, mode, created: result.created } satisfies ImportResponse);
  } catch (error) {
    if (error instanceof ImportFileError) return deny(400, error.message);

    const reference = crypto.randomUUID().slice(0, 8);
    logger.error("Employee import failed", {
      reference,
      mode,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    });
    return deny(500, `Import failed. Reference ${reference}.`);
  }
}

function deny(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message } satisfies ImportResponse, { status });
}
