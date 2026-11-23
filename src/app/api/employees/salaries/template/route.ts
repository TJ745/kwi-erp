import { NextResponse } from "next/server";
import { getActorContext } from "@/server/auth/context";
import { buildSalaryTemplate } from "@/server/import/salary-workbook";
import { salaryTemplateRows } from "@/server/services/salary-import";

export const runtime = "nodejs";

/**
 * The salary workbook, pre-filled with every employee in the actor's scope
 * and their current salary. It carries salary figures, so it needs the same
 * permissions as the upload it feeds.
 */
export async function GET() {
  const ctx = await getActorContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (
    !ctx.permissions.has("employees.salary.view") ||
    !ctx.permissions.has("employees.salary.manage")
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const workbook = await buildSalaryTemplate(await salaryTemplateRows(ctx));
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employee-salaries-${stamp}.xlsx"`,
      "Cache-Control": "no-store, private",
    },
  });
}
