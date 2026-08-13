import type { Metadata } from "next";
import { BriefcaseBusiness, Network } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listCompanies, listDepartments, listPositions } from "@/server/services/org";
import { DepartmentDialog } from "./department-dialog";
import { PositionDialog } from "./position-dialog";

export const metadata: Metadata = { title: "Departments & Positions" };

export default async function DepartmentsPage() {
  const ctx = await requirePagePermission("departments.view");

  // Positions carry their own permission pair, so the section is fetched and
  // rendered only for actors who hold it — an actor may manage departments
  // without managing job titles.
  const canViewPositions = ctx.permissions.has("positions.view");
  const canManagePositions = ctx.permissions.has("positions.manage");

  const [departments, companies, positions] = await Promise.all([
    listDepartments(ctx),
    listCompanies(ctx),
    canViewPositions ? listPositions(ctx) : Promise.resolve([]),
  ]);

  const canManage = ctx.permissions.has("departments.manage");
  const options = companies.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  const parentOptions = departments.map((d) => ({
    id: d.id,
    name: d.name,
    companyId: d.companyId,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Departments & Positions"
        description="Departments are company-scoped and can nest — a manager's visibility follows the department subtree. Positions are job titles, optionally shared across companies."
        action={
          canManage ? (
            <DepartmentDialog mode="create" companies={options} parents={parentOptions} />
          ) : null
        }
      />

      <h2 className="text-sm font-semibold">Departments</h2>

      {departments.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No departments"
          description="Add departments so employees can be organised and managers scoped."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Departments by company</caption>
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Employees</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canManage ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} className="border-t">
                  <td className="px-4 py-2">
                    <p className="font-medium">{dept.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">{dept.code}</p>
                  </td>
                  <td className="px-4 py-2">{dept.company.code}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {dept.parent?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{dept._count.employees}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={dept.status} />
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2 text-right">
                      <DepartmentDialog
                        mode="edit"
                        companies={options}
                        parents={parentOptions}
                        department={{
                          id: dept.id,
                          code: dept.code,
                          name: dept.name,
                          companyId: dept.companyId,
                          parentId: dept.parentId,
                          status: dept.status,
                        }}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canViewPositions ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Positions</h2>
            {canManagePositions ? (
              <PositionDialog mode="create" companies={options} />
            ) : null}
          </div>

          {positions.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No positions"
              description="Add job titles so employees can be given a position on their employment record."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">Positions</caption>
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="px-4 py-2 font-medium">Company</th>
                    <th className="px-4 py-2 font-medium">Grade</th>
                    <th className="px-4 py-2 font-medium">Employees</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    {canManagePositions ? <th className="px-4 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.id} className="border-t">
                      <td className="px-4 py-2">
                        <p className="font-medium">{position.title}</p>
                        {position.titleAr ? (
                          <p className="text-muted-foreground text-xs">{position.titleAr}</p>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground px-4 py-2">
                        {position.company?.code ?? "All companies"}
                      </td>
                      <td className="text-muted-foreground px-4 py-2">
                        {position.grade ?? "—"}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{position._count.employees}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={position.status} />
                      </td>
                      {canManagePositions ? (
                        <td className="px-4 py-2 text-right">
                          <PositionDialog
                            mode="edit"
                            companies={options}
                            position={{
                              id: position.id,
                              title: position.title,
                              titleAr: position.titleAr,
                              grade: position.grade,
                              companyId: position.companyId,
                              status: position.status,
                            }}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
