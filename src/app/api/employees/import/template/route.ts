import { NextResponse } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { buildEmployeeTemplate } from "@/server/import/employee-workbook";
import { importTemplateReferences } from "@/server/services/employee-import";

export const runtime = "nodejs";

/**
 * The blank import template, with the actor's own companies, departments and
 * positions on its Reference sheet. Gated like the import itself: the
 * department and position lists are org structure, not public.
 */
export async function GET() {
  const ctx = await getActorContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!ctx.permissions.has("employees.create")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const workbook = await buildEmployeeTemplate(await importTemplateReferences(ctx));

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employee-import-template.xlsx"',
      "Cache-Control": "no-store, private",
    },
  });
}
