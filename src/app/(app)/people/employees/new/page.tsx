import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { orgOptions } from "@/server/services/org";
import { managerOptions } from "@/server/services/employees";
import { EmployeeForm } from "../employee-form";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const ctx = await requirePagePermission("employees.create");
  const options = await orgOptions(ctx);

  // Managers are company-scoped; seed the list from the first company the
  // actor can see, which is also the form's default selection.
  const firstCompanyId = options.companies[0]?.id;
  const managers = firstCompanyId ? await managerOptions(ctx, firstCompanyId) : [];

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
        title="Add employee"
        description="Enter the employee's own ID as your company numbers its staff."
      />

      <EmployeeForm mode="create" options={{ ...options, managers }} />
    </PageShell>
  );
}
