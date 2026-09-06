import type { Metadata } from "next";
import Link from "next/link";
import { Laptop } from "lucide-react";
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
import { assetCounts, listAssets, type AssetListRow } from "@/server/services/assets";
import { orgOptions } from "@/server/services/org";
import { AssetDialog } from "./asset-dialog";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "IT Assets" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission("it.assets.view");
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = {
    status: typeof params.status === "string" ? params.status : undefined,
    type: typeof params.type === "string" ? params.type : undefined,
  };

  const canManage = ctx.permissions.has("it.assets.manage");

  const [data, counts, options] = await Promise.all([
    listAssets(ctx, query, filters),
    assetCounts(ctx),
    canManage ? orgOptions(ctx) : Promise.resolve(null),
  ]);

  const columns: readonly Column<AssetListRow>[] = [
    {
      key: "assetCode",
      header: "Asset",
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.brand} {row.model}
          </p>
          <p className="text-muted-foreground font-mono text-xs">{row.assetCode}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      primary: true,
      cell: (row) => (
        <span className="text-sm">{row.type.replace(/_/g, " ").toLowerCase()}</span>
      ),
    },
    {
      key: "serialNumber",
      header: "Serial",
      cell: (row) => (
        <span className="font-mono text-xs">{row.serialNumber ?? "—"}</span>
      ),
    },
    {
      key: "assignedTo",
      header: "Issued to",
      primary: true,
      cell: (row) =>
        row.assignedToId ? (
          <Link
            href={`/people/employees/${row.assignedToId}`}
            className="text-sm hover:underline"
          >
            {row.assignedToName}
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "warrantyExpiry",
      header: "Warranty",
      sortable: true,
      cell: (row) => <ExpiryDate date={row.warrantyExpiry} />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="IT Assets"
        description="Hardware register and handover history. An asset can only be issued to one person at a time."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="it-asset-register" ctx={ctx} />
            {canManage && options ? (
              <AssetDialog companies={options.companies} />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Total" value={counts.total} href="/it/assets" />
        <CountCard
          label="Available"
          value={counts.available}
          href={`/it/assets${buildQueryString({}, { status: "AVAILABLE" })}`}
        />
        <CountCard
          label="Issued"
          value={counts.assigned}
          href={`/it/assets${buildQueryString({}, { status: "ASSIGNED" })}`}
        />
        <CountCard
          label="Under repair"
          value={counts.underRepair}
          tone="warning"
          href={`/it/assets${buildQueryString({}, { status: "UNDER_REPAIR" })}`}
        />
      </div>

      <SearchInput placeholder="Search by code, serial, brand, or model…" />

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/it/assets"
        rowHref={(row) => `/it/assets/${row.id}`}
        caption="IT asset register"
        emptyState={
          <EmptyState
            icon={Laptop}
            title="No assets yet"
            description="Register laptops, monitors, printers, and phones to track who holds what."
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
