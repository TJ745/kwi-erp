import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { parseListQuery, type SearchParams } from "@/lib/list-query";
import { PERMISSIONS, PERMISSION_KEYS, SUPER_ADMIN_ROLE_KEY } from "@/lib/permissions";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listUsers, type UserListRow } from "@/server/services/users";
import { UserRowActions } from "./user-row-actions";
import { UserDialog } from "./user-dialog";
import { ReportLink } from "@/components/shared/report-link";
import {
  employeesWithoutUser,
  listCompaniesForAssignment,
  listRolesForAssignment,
} from "@/server/services/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePagePermission("users.view");
  const params = await searchParams;
  const query = parseListQuery(params);

  const canManage = ctx.permissions.has("users.manage");

  const [data, roles, companies, unlinkedEmployees] = await Promise.all([
    listUsers(ctx, query),
    listRolesForAssignment(ctx),
    listCompaniesForAssignment(ctx),
    // For the create dialog and the "Link to employee" action, which only a manager sees.
    canManage ? employeesWithoutUser(ctx) : Promise.resolve([]),
  ]);

  // The dialog offers only what the server will accept: an ALLOW override can
  // never hand out a permission the actor does not hold themselves.
  const allPermissions = PERMISSION_KEYS.map((key) => ({ key, label: PERMISSIONS[key].label }));
  const grantablePermissions = allPermissions.filter((p) => ctx.permissions.has(p.key));

  const columns: readonly Column<UserListRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="text-muted-foreground truncate text-xs">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      primary: true,
      cell: (row) => <Badge variant="outline">{row.roleKey.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      primary: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.mustChangePassword ? (
            <Badge variant="warning" title="Must set a new password at next sign-in">
              Password reset
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "employee",
      header: "Employee",
      cell: (row) =>
        row.employee ? (
          <Link href={`/people/employees/${row.employee.id}`} className="text-sm hover:underline">
            {row.employee.fullName}
            <span className="text-muted-foreground ml-1 font-mono text-xs">
              {row.employee.employeeNo}
            </span>
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "companies",
      header: "Companies",
      cell: (row) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {row.allCompanies ? "All" : row.companyCount === 0 ? "None" : row.companyCount}
        </span>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Last sign-in",
      sortable: true,
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="text-sm" title={row.lastLoginAt.toISOString()}>
            {formatDistanceToNow(row.lastLoginAt, { addSuffix: true })}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Never</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) =>
        canManage ? (
          <UserRowActions
            user={{
              id: row.id,
              name: row.name,
              status: row.status,
              roleKey: row.roleKey,
              employee: row.employee,
              allCompanies: row.allCompanies,
            }}
            roles={roles}
            companies={companies}
            isSelf={row.id === ctx.userId}
            canLinkSelf={ctx.roleKey === SUPER_ADMIN_ROLE_KEY}
            employees={unlinkedEmployees}
            overrides={row.overrides.map((o) => ({
              key: o.key,
              label: o.label,
              effect: o.effect,
              expiresAt: o.expiresAt ? o.expiresAt.toISOString().slice(0, 10) : null,
            }))}
            grantablePermissions={grantablePermissions}
            allPermissions={allPermissions}
          />
        ) : null,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        printable
        title="Users"
        description="Accounts, roles, and company access. Users are created by an administrator; there is no self-registration."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="user-register" ctx={ctx} />
            {canManage ? (
              <UserDialog
                roles={roles.map((r) => ({ id: r.id, label: r.name }))}
                companies={companies.map((c) => ({
                  id: c.id,
                  label: `${c.code} — ${c.name}`,
                }))}
                employees={unlinkedEmployees.map((e) => ({
                  id: e.id,
                  label: `${e.fullName} (${e.employeeNo})`,
                }))}
              />
            ) : null}
          </div>
        }
      />

      <SearchInput placeholder="Search by name or email…" />

      <DataTable
        data={data}
        columns={columns}
        searchParams={params}
        basePath="/settings/users"
        caption="System users"
        emptyState={
          <EmptyState
            title="No users yet"
            description="Run the seed or create the first administrator."
          />
        }
      />
    </PageShell>
  );
}
