import type { Metadata } from "next";
import Link from "next/link";
import { Printer, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { parseListQuery, type SearchParams } from "@/lib/list-query";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listMaintenance } from "@/server/services/fleet";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Vehicle maintenance" };

type Row = Awaited<ReturnType<typeof listMaintenance>>["rows"][number];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("vehicles.maintenance.view");
  const params = await searchParams;
  const data = await listMaintenance(ctx, parseListQuery(params));

  const columns: readonly Column<Row>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/vehicles/${row.vehicle.id}`}
            className="truncate font-medium hover:underline"
          >
            {row.vehicle.plateNumber}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {row.vehicle.make} {row.vehicle.model}
          </p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      primary: true,
      cell: (row) => (
        <span className="text-sm tabular-nums">{row.date.toISOString().slice(0, 10)}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      primary: true,
      cell: (row) => <span className="text-sm">{row.type.replace(/_/g, " ").toLowerCase()}</span>,
    },
    {
      key: "description",
      header: "Work done",
      cell: (row) => <span className="text-sm">{row.description}</span>,
    },
    {
      key: "mileage",
      header: "Mileage",
      align: "right",
      cell: (row) => <span className="text-sm tabular-nums">{row.mileage ?? "—"}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.cost ? `${row.cost.toString()} ${row.currency}` : "—"}
        </span>
      ),
    },
    {
      key: "nextDueDate",
      header: "Next due",
      primary: true,
      cell: (row) => <ExpiryDate date={row.nextDueDate} horizonDays={30} />,
    },
    {
      key: "print",
      header: "",
      align: "right",
      cell: (row) => (
        <Button asChild size="sm" variant="outline" data-print-hide>
          <Link href={"/vehicles/maintenance/" + row.id}>
            <Printer />
            {row.requestNo ?? "Print"}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        printable
        title="Vehicle maintenance"
        description="Service history across the fleet. Record maintenance from a vehicle's page."
        action={<ReportLink reportId="vehicle-maintenance" ctx={ctx} />}
      />

      <SearchInput placeholder="Search by plate, workshop, or work done…" />

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/vehicles/maintenance"
        caption="Fleet maintenance history"
        emptyState={
          <EmptyState
            icon={Wrench}
            title="No maintenance recorded"
            description="Open a vehicle and record a service, repair, or inspection."
          />
        }
      />
    </PageShell>
  );
}
