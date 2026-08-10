import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { parseListQuery, type SearchParams } from "@/lib/list-query";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listEmployees, type EmployeeListRow } from "@/server/services/employees";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("employees.view");
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = {
    status: typeof params.status === "string" ? params.status : undefined,
    companyId: typeof params.company === "string" ? params.company : undefined,
    departmentId: typeof params.department === "string" ? params.department : undefined,
  };

  const data = await listEmployees(ctx, query, filters);
  const canCreate = ctx.permissions.has("employees.create");

  const columns: readonly Column<EmployeeListRow>[] = [
    {
      key: "fullName",
      header: "Employee",
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.fullName}</p>
          <p className="text-muted-foreground font-mono text-xs">{row.employeeNo}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      cell: (row) => <span className="text-sm">{row.companyCode}</span>,
    },
    {
      key: "department",
      header: "Department",
      primary: true,
      cell: (row) => (
        <span className="text-sm">{row.departmentName ?? "—"}</span>
      ),
    },
    {
      key: "position",
      header: "Position",
      cell: (row) => <span className="text-sm">{row.positionTitle ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "iqamaExpiry",
      header: "Iqama expiry",
      primary: true,
      cell: (row) => <ExpiryDate date={row.iqamaExpiry} />,
    },
    {
      key: "joiningDate",
      header: "Joined",
      sortable: true,
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.joiningDate.toISOString().slice(0, 10)}
        </span>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Employees"
        description={
          ctx.companyScope === "ALL"
            ? "All companies."
            : "Scoped to the companies you have access to."
        }
        action={
          canCreate ? (
            <Link href="/people/employees/new" className={buttonVariants({ size: "sm" })}>
              <Plus />
              Add employee
            </Link>
          ) : null
        }
      />

      <SearchInput placeholder="Search by name, number, email, or mobile…" />

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/people/employees"
        rowHref={(row) => `/people/employees/${row.id}`}
        caption="Employee directory"
        emptyState={
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add the first employee to begin building the directory."
            action={
              canCreate ? (
                <Link
                  href="/people/employees/new"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Add employee
                </Link>
              ) : null
            }
          />
        }
      />
    </PageShell>
  );
}
