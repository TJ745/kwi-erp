import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { buildQueryString, parseListQuery, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  contractCounts,
  listContracts,
  type ContractListRow,
} from "@/server/services/contracts";

export const metadata: Metadata = { title: "Contracts" };

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("hr.contracts.view");
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = { status: typeof params.status === "string" ? params.status : undefined };

  const [data, counts] = await Promise.all([
    listContracts(ctx, query, filters),
    contractCounts(ctx),
  ]);

  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const columns: readonly Column<ContractListRow>[] = [
    {
      key: "employee",
      header: "Employee",
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/people/employees/${row.employeeId}`}
            className="truncate font-medium hover:underline"
          >
            {row.employeeName}
          </Link>
          <p className="text-muted-foreground font-mono text-xs">{row.employeeNo}</p>
        </div>
      ),
    },
    {
      key: "contractType",
      header: "Type",
      primary: true,
      cell: (row) => (
        <span className="text-sm">
          {row.contractType.replace(/_/g, " ").toLowerCase()}
        </span>
      ),
    },
    {
      key: "startDate",
      header: "Start",
      sortable: true,
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.startDate.toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "endDate",
      header: "End",
      sortable: true,
      primary: true,
      cell: (row) =>
        row.endDate ? (
          <ExpiryDate date={row.endDate} />
        ) : (
          <span className="text-muted-foreground text-sm">Open-ended</span>
        ),
    },
    // The whole column is omitted without the permission, rather than blanked.
    ...(canSeeSalary
      ? [
          {
            key: "salary",
            header: "Basic salary",
            align: "right" as const,
            cell: (row: ContractListRow) => (
              <span className="text-sm tabular-nums">
                {row.basicSalary ? `${row.basicSalary} ${row.currency}` : "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Contracts"
        description="Employment contracts. Those with an end date appear in expiry alerts automatically."
      />

      <div className="grid grid-cols-3 gap-3">
        <CountCard label="Active" value={counts.active} href="/hr/contracts" />
        <CountCard
          label="Expiring in 90 days"
          value={counts.expiringIn90Days}
          tone="warning"
          href="/hr/contracts"
        />
        <CountCard
          label="Past end date"
          value={counts.expired}
          tone="expired"
          href="/hr/contracts"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by employee…" />
        <FilterChip label="All" href="/hr/contracts" active={!filters.status} />
        <FilterChip
          label="Active"
          href={`/hr/contracts${buildQueryString({}, { status: "ACTIVE" })}`}
          active={filters.status === "ACTIVE"}
        />
        <FilterChip
          label="Expired"
          href={`/hr/contracts${buildQueryString({}, { status: "EXPIRED" })}`}
          active={filters.status === "EXPIRED"}
        />
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/hr/contracts"
        caption="Employment contracts"
        emptyState={
          <EmptyState
            icon={FileSignature}
            title="No contracts yet"
            description="Add a contract from an employee's profile. Fixed-term contracts feed the expiry alerts."
          />
        }
      />
    </PageShell>
  );
}

function CountCard({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "warning" | "expired";
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-foreground/20 gap-0 py-4 transition-colors">
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              value > 0 && tone === "expired" && "text-status-expired",
              value > 0 && tone === "warning" && "text-status-warning",
            )}
          >
            {value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
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
