import type { Metadata } from "next";
import { Plug } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listMeters } from "@/server/services/meters";
import { MeterControls } from "./meter-controls";

export const metadata: Metadata = { title: "Utility Bills" };

export default async function UtilityBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requirePagePermission("meters.view");
  const { q } = await searchParams;
  const canManage = ctx.permissions.has("meters.manage");

  const meters = await listMeters({ ...(q ? { q } : {}) });

  return (
    <PageShell>
      <PageHeader
        title="Utility Bills"
        description="Meter numbers, where each meter is, and what it is for."
        printable
        action={canManage ? <MeterControls mode="create" /> : null}
      />

      <SearchInput placeholder="Search meter number, location, or description…" />

      {meters.length === 0 ? (
        <EmptyState
          icon={Plug}
          title={q ? "No matching meters" : "No meters yet"}
          description={q ? "Try a different search." : "Add a meter number, its location, and a description."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Meter number</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{m.meterNumber}</td>
                  <td className="px-3 py-2">{m.location}</td>
                  <td className="text-muted-foreground px-3 py-2">{m.description ?? "—"}</td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <MeterControls
                        mode="row"
                        values={{
                          id: m.id,
                          meterNumber: m.meterNumber,
                          location: m.location,
                          description: m.description,
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

      <p className="text-muted-foreground text-xs">
        {meters.length} {meters.length === 1 ? "meter" : "meters"}
      </p>
    </PageShell>
  );
}
