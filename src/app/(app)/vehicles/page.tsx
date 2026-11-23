import type { Metadata } from "next";
import Link from "next/link";
import { Car } from "lucide-react";
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
import { fleetCounts, listVehicles, type VehicleListRow } from "@/server/services/fleet";
import { orgOptions } from "@/server/services/org";
import { VehicleDialog } from "./vehicle-dialog";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("vehicles.view");
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = { status: typeof params.status === "string" ? params.status : undefined };
  const canManage = ctx.permissions.has("vehicles.manage");

  const [data, counts, options] = await Promise.all([
    listVehicles(ctx, query, filters),
    fleetCounts(ctx),
    canManage ? orgOptions(ctx) : Promise.resolve(null),
  ]);

  const columns: readonly Column<VehicleListRow>[] = [
    {
      key: "plateNumber",
      header: "Vehicle",
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.plateNumber}</p>
          <p className="text-muted-foreground truncate text-xs">
            {row.make} {row.model} · {row.year}
          </p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      cell: (row) => <span className="text-sm">{row.companyCode}</span>,
    },
    {
      key: "driver",
      header: "Driver",
      primary: true,
      cell: (row) =>
        row.currentDriverId ? (
          <Link
            href={`/people/employees/${row.currentDriverId}`}
            className="text-sm hover:underline"
          >
            {row.currentDriverName}
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">Unassigned</span>
        ),
    },
    {
      key: "registrationExpiry",
      header: "Registration",
      sortable: true,
      primary: true,
      cell: (row) => <ExpiryDate date={row.registrationExpiry} />,
    },
    {
      key: "insuranceExpiry",
      header: "Insurance",
      sortable: true,
      primary: true,
      cell: (row) => <ExpiryDate date={row.insuranceExpiry} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        printable
        title="Vehicles"
        description="Fleet register. Registration and insurance expiry both feed the dashboard alerts."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="fleet-register" ctx={ctx} />
            {canManage && options ? <VehicleDialog companies={options.companies} /> : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Total" value={counts.total} href="/vehicles" />
        <CountCard
          label="Active"
          value={counts.active}
          href={`/vehicles${buildQueryString({}, { status: "ACTIVE" })}`}
        />
        <CountCard
          label="Registration due"
          value={counts.registrationDue}
          tone="warning"
          href="/vehicles?sort=registrationExpiry.asc"
        />
        <CountCard
          label="Insurance due"
          value={counts.insuranceDue}
          tone="warning"
          href="/vehicles?sort=insuranceExpiry.asc"
        />
      </div>

      <SearchInput placeholder="Search by plate, code, make, model, or VIN…" />

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/vehicles"
        rowHref={(row) => `/vehicles/${row.id}`}
        caption="Vehicle fleet"
        emptyState={
          <EmptyState
            icon={Car}
            title="No vehicles yet"
            description="Register a vehicle to track its registration, insurance, driver, and service history."
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
  tone?: "neutral" | "warning";
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-foreground/20 gap-0 py-4 transition-colors">
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
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
