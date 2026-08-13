import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listSuppliers, supplierCategories } from "@/server/services/vendors";
import { orgOptions } from "@/server/services/org";
import { SupplierDialog } from "./supplier-dialog";
import { SupplierRowActions } from "./supplier-row-actions";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requirePagePermission("suppliers.view");
  const { q, status } = await searchParams;
  const canManage = ctx.permissions.has("suppliers.manage");

  const [suppliers, categories, options] = await Promise.all([
    listSuppliers(ctx, { ...(q ? { q } : {}), ...(status ? { status } : {}) }),
    supplierCategories(),
    orgOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Suppliers"
        description="Vendors the company buys from. A supplier with no company is shared across both entities."
        action={
          canManage ? (
            <SupplierDialog companies={options.companies} categories={categories} />
          ) : null
        }
      />

      <SearchInput placeholder="Search name, code, or contact…" />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={q ? "No matching suppliers" : "No suppliers"}
          description={
            q
              ? "Try a different search term."
              : "Add a supplier to track contacts and payment terms."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Contact</th>
                <th className="px-3 py-2 text-left font-medium">Terms</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {s.category?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {s.contactPerson ?? <span className="text-muted-foreground">—</span>}
                    {s.phone ? (
                      <p className="text-muted-foreground text-xs">{s.phone}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {s.paymentType === "CREDIT" ? (
                      <span>
                        Credit
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          · {s.creditDays ?? 0} days
                        </span>
                      </span>
                    ) : (
                      "Cash"
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {s.company?.code ?? "All"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={s.status === "ACTIVE" ? "default" : "outline"}>
                      {s.status}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <SupplierRowActions
                        supplier={{
                          id: s.id,
                          code: s.code,
                          name: s.name,
                          contactPerson: s.contactPerson,
                          phone: s.phone,
                          email: s.email,
                          companyId: s.companyId,
                          categoryId: s.categoryId,
                          paymentType: s.paymentType,
                          creditDays: s.creditDays,
                          status: s.status,
                          notes: s.notes,
                        }}
                        companies={options.companies}
                        categories={categories}
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
