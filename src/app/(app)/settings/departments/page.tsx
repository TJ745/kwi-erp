import type { Metadata } from "next";
import { Network } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listCompanies, listDepartments } from "@/server/services/org";
import { DepartmentDialog } from "./department-dialog";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const ctx = await requirePagePermission("departments.view");
  const [departments, companies] = await Promise.all([
    listDepartments(ctx),
    listCompanies(ctx),
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
        title="Departments"
        description="Departments are company-scoped and can nest. A manager's visibility follows the department subtree."
        action={
          canManage ? (
            <DepartmentDialog mode="create" companies={options} parents={parentOptions} />
          ) : null
        }
      />

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
    </PageShell>
  );
}
