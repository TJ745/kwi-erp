import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { buildQueryString, parseListQuery, type SearchParams } from "@/lib/list-query";
import { cn } from "@/lib/utils";
import { requirePageAnyPermission } from "@/server/auth/page-guards";
import {
  listTickets,
  ticketCategories,
  ticketCounts,
  type TicketListRow,
} from "@/server/services/helpdesk";
import { orgOptions } from "@/server/services/org";
import { TicketCreateButton } from "./ticket-form";

export const metadata: Metadata = { title: "IT Helpdesk" };

export default async function HelpdeskPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageAnyPermission(["it.tickets.view", "it.tickets.create"]);
  const params = await searchParams;
  const query = parseListQuery(params);

  const filters = {
    status: typeof params.status === "string" ? params.status : undefined,
    priority: typeof params.priority === "string" ? params.priority : undefined,
    mine: params.mine === "1",
  };

  const [data, counts, categories, options] = await Promise.all([
    listTickets(ctx, query, filters),
    ticketCounts(ctx),
    ticketCategories(),
    orgOptions(ctx),
  ]);

  const isItStaff = ctx.permissions.has("it.tickets.assign");

  const columns: readonly Column<TicketListRow>[] = [
    {
      key: "subject",
      header: "Ticket",
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.subject}</p>
          <p className="text-muted-foreground font-mono text-xs">{row.ticketNo}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      primary: true,
      cell: (row) => <span className="text-sm">{row.categoryName}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      primary: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "requester",
      header: "Raised by",
      cell: (row) => <span className="text-sm">{row.requesterName ?? "—"}</span>,
    },
    {
      key: "assignedTo",
      header: "Assigned to",
      cell: (row) => (
        <span className="text-sm">
          {row.assignedToName ?? (
            <span className="text-status-warning font-medium">Unassigned</span>
          )}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Raised",
      sortable: true,
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.createdAt.toISOString().slice(0, 10)}
        </span>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="IT Helpdesk"
        description={
          isItStaff
            ? "All tickets in your companies."
            : "Tickets you raised or that are assigned to you."
        }
        action={
          ctx.permissions.has("it.tickets.create") ? (
            <TicketCreateButton
              companies={options.companies}
              departments={options.departments}
              categories={categories}
            />
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard
          label="Open"
          value={counts.open}
          href={`/it/helpdesk${buildQueryString({}, { status: "OPEN_ONLY" })}`}
        />
        <CountCard
          label="Unassigned"
          value={counts.unassigned}
          tone="warning"
          href="/it/helpdesk"
        />
        <CountCard
          label="Critical"
          value={counts.critical}
          tone="expired"
          href={`/it/helpdesk${buildQueryString({}, { priority: "CRITICAL" })}`}
        />
        <CountCard
          label="Assigned to me"
          value={counts.mine}
          href={`/it/helpdesk${buildQueryString({}, { mine: 1 })}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by subject or number…" />
        <FilterChip label="All" href="/it/helpdesk" active={!filters.status && !filters.mine} />
        <FilterChip
          label="Open"
          href={`/it/helpdesk${buildQueryString({}, { status: "OPEN_ONLY" })}`}
          active={filters.status === "OPEN_ONLY"}
        />
        <FilterChip
          label="Resolved"
          href={`/it/helpdesk${buildQueryString({}, { status: "RESOLVED" })}`}
          active={filters.status === "RESOLVED"}
        />
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/it/helpdesk"
        rowHref={(row) => `/it/helpdesk/${row.id}`}
        caption="IT support tickets"
        emptyState={
          <EmptyState
            icon={LifeBuoy}
            title="No tickets"
            description="Raise a ticket for a computer, printer, network, or account problem."
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
