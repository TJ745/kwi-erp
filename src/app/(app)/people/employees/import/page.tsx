import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import employees" };

export default async function ImportEmployeesPage() {
  await requirePagePermission("employees.create");

  return (
    <PageShell>
      <Link
        href="/people/employees"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to employees
      </Link>

      <PageHeader
        title="Import employees"
        description="Fill the Excel template, upload it, check the preview, then import. Either every row goes in or none does."
      />

      <ImportWizard />
    </PageShell>
  );
}
