import type { Metadata } from "next";
import { forPicker } from "@/lib/employee-status";
import Link from "next/link";
import { FileSignature, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ReportLink } from "@/components/shared/report-link";
import {
  allowanceValue,
  contractCounts,
  contractsForEdit,
  listContracts,
  type ContractListRow,
} from "@/server/services/contracts";
import { listJobDescriptions } from "@/server/services/hiring";
import { employeeOptions } from "@/server/services/hr-records";
import { contractParticularsSchema } from "@/lib/schemas/hr";
import { ContractDialog, type ContractFormValues } from "./contract-dialog";

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

  const canManage = ctx.permissions.has("hr.contracts.manage");
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const [data, counts, everyone, jobDescriptions] = await Promise.all([
    listContracts(ctx, query, filters),
    contractCounts(ctx),
    canManage ? employeeOptions(ctx) : Promise.resolve([]),
    canManage
      ? listJobDescriptions(ctx).then((rows) =>
          rows.filter((r) => r.isActive).map((r) => ({ id: r.id, title: r.title })),
        )
      : Promise.resolve([]),
  ]);
  const employees = forPicker(everyone, data.rows.map((r) => r.employeeId));

  // The full form values of this page's rows, for Edit.
  const editable = canManage
    ? new Map(
        (
          await contractsForEdit(
            ctx,
            data.rows.map((r) => r.id),
          )
        ).map((c) => [
          c.id,
          {
            id: c.id,
            employeeId: c.employeeId,
            companyId: c.companyId,
            contractType: c.contractType,
            startDate: day(c.startDate),
            endDate: c.endDate ? day(c.endDate) : null,
            probationEndDate: c.probationEndDate ? day(c.probationEndDate) : null,
            status: c.status,
            currency: c.currency,
            basicSalary: c.basicSalary ? c.basicSalary.toString() : null,
            housingAllowance: allowanceValue(c.allowances, "housing"),
            transportAllowance: allowanceValue(c.allowances, "transport"),
            otherAllowance: allowanceValue(c.allowances, "other"),
            foodAllowance: allowanceValue(c.allowances, "food"),
            additionalAllowance: allowanceValue(c.allowances, "additional"),
            notes: c.notes,
            contractDate: c.contractDate ? day(c.contractDate) : null,
            positionTitle: c.positionTitle,
            jobDescriptionId: c.jobDescriptionId,
            termYears: c.termYears,
            workDaysPerWeek: c.workDaysPerWeek,
            hoursPerDay: c.hoursPerDay,
            particulars: c.particulars
              ? (contractParticularsSchema.safeParse(c.particulars).data ?? null)
              : null,
          } satisfies ContractFormValues & { employeeId: string; companyId: string },
        ]),
      )
    : new Map<string, never>();

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
        <span className="text-sm">{row.contractType.replace(/_/g, " ").toLowerCase()}</span>
      ),
    },
    {
      key: "startDate",
      header: "Start",
      sortable: true,
      cell: (row) => (
        <span className="text-sm tabular-nums">{row.startDate.toISOString().slice(0, 10)}</span>
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
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => {
        const contract = editable.get(row.id);
        return (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap" data-print-hide>
            {/* The printed contract states the salary. */}
            {canSeeSalary ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/hr/contracts/${row.id}`} target="_blank" rel="noopener">
                  <Printer />
                  Print
                </Link>
              </Button>
            ) : null}
            {contract ? (
              <ContractDialog
                canSeeSalary={canSeeSalary}
                contract={contract}
                jobDescriptions={jobDescriptions}
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell>
      <PageHeader
        printable
        title="Contracts"
        description="Employment contracts. Those with an end date appear in expiry alerts automatically."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="contract-register" ctx={ctx} />
            {canManage ? (
              <ContractDialog
                canSeeSalary={canSeeSalary}
                employees={employees.map((e) => ({
                  id: e.id,
                  fullName: e.fullName,
                  employeeNo: e.employeeNo,
                  companyId: e.companyId,
                }))}
                jobDescriptions={jobDescriptions}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3" data-print-hide>
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
            description="Use Add contract to make one. Fixed-term contracts feed the expiry alerts."
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

const day = (d: Date) => d.toISOString().slice(0, 10);
