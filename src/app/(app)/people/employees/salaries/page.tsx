import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { SalaryWizard } from "./salary-wizard";

export const metadata: Metadata = { title: "Update salaries" };

export default async function UpdateSalariesPage() {
  const ctx = await requirePagePermission("employees.salary.manage");
  if (!ctx.permissions.has("employees.salary.view")) redirect("/people/employees");

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
        title="Update salaries"
        description="Load or change everyone's salary at once from Excel: Basic, Transport, Housing and Mobile / Food. Increment lists take each employee's current salary from here."
      />
      <SalaryWizard />
    </PageShell>
  );
}
