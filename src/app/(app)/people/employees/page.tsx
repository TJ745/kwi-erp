import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Upload, Users, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { buildQueryString, parseListQuery, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { orgOptions } from "@/server/services/org";
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

  const [data, { companies }] = await Promise.all([
    listEmployees(ctx, query, filters),
    orgOptions(ctx),
  ]);
  // A filter link keeps the search and the other filter, and starts at page 1.
  const filterHref = (changes: Record<string, string | undefined>) =>
    `/people/employees${buildQueryString(params, { ...changes, page: undefined })}`;
  const canCreate = ctx.permissions.has("employees.create");
  const canUpdateSalaries =
    ctx.permissions.has("employees.salary.view") && ctx.permissions.has("employees.salary.manage");

  const columns: readonly Column<EmployeeListRow>[] = [
    {
      key: "employeeNo",
      header: "Employee ID",
      sortable: true,
      primary: true,
      cell: (row) => <span className="font-mono text-sm">{row.employeeNo}</span>,
    },
    {
      key: "fullName",
      header: "Employee name",
      sortable: true,
      primary: true,
      cell: (row) => <span className="font-medium">{row.fullName}</span>,
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
      cell: (row) => <span className="text-sm">{row.departmentName ?? "—"}</span>,
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
        <span className="text-sm tabular-nums">{row.joiningDate.toISOString().slice(0, 10)}</span>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        printable={ctx.permissions.has("employees.export")}
        title="Employees"
        description={
          ctx.companyScope === "ALL"
            ? "All companies."
            : "Scoped to the companies you have access to."
        }
        action={
          canCreate || canUpdateSalaries ? (
            <div className="flex flex-wrap items-center gap-2">
              {canUpdateSalaries ? (
                <Link
                  href="/people/employees/salaries"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Wallet />
                  Update salaries
                </Link>
              ) : null}
              {canCreate ? (
                <>
                  <Link
                    href="/people/employees/import"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Upload />
                    Import
                  </Link>
                  <Link href="/people/employees/new" className={buttonVariants({ size: "sm" })}>
                    <Plus />
                    Add employee
                  </Link>
                </>
              ) : null}
            </div>
          ) : null
        }
      />

      <SearchInput placeholder="Search by name, number, email, or mobile…" />

      <div className="space-y-2" data-print-hide>
        {companies.length > 1 ? (
          <FilterRow label="Company">
            <FilterChip
              label="All"
              href={filterHref({ company: undefined })}
              active={!filters.companyId}
            />
            {companies.map((c) => (
              <FilterChip
                key={c.id}
                label={c.code}
                href={filterHref({ company: c.id })}
                active={filters.companyId === c.id}
              />
            ))}
          </FilterRow>
        ) : null}
        <FilterRow label="Status">
          <FilterChip
            label="All"
            href={filterHref({ status: undefined })}
            active={!filters.status}
          />
          {EMPLOYEE_STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}
              href={filterHref({ status: s })}
              active={filters.status === s}
            />
          ))}
        </FilterRow>
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/people/employees"
        rowHref={(row) => `/people/employees/${row.id}`}
        // Both the ID and the name open the profile.
        linkColumns={["employeeNo", "fullName"]}
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

const EMPLOYEE_STATUSES = [
  "NEW_HIRE",
  "ACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "TERMINATED",
  "EXITED",
  "INACTIVE",
] as const;

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground w-16 text-xs">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "hover:bg-accent text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}
