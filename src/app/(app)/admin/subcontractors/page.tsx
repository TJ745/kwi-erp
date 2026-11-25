import type { Metadata } from "next";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  getSubcontractDefaultTerms,
  listSubcontractors,
  vendorCounts,
} from "@/server/services/vendors";
import { SubcontractorDialog } from "./subcontractor-dialog";
import { DefaultTermsDialog } from "./default-terms-dialog";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Subcontractors" };

export default async function SubcontractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requirePagePermission("subcontractors.view");
  const { q, status } = await searchParams;
  const canManage = ctx.permissions.has("subcontractors.manage");

  const [subcontractors, counts, defaultTerms] = await Promise.all([
    listSubcontractors(ctx, { ...(q ? { q } : {}), ...(status ? { status } : {}) }),
    vendorCounts(ctx),
    canManage ? getSubcontractDefaultTerms() : Promise.resolve(""),
  ]);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Subcontractors"
        description="Companies working under contract. Contract end dates feed the expiry register and the reminder engine."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="subcontractor-register" ctx={ctx} />
            {canManage ? <DefaultTermsDialog terms={defaultTerms} /> : null}
            {canManage ? <SubcontractorDialog /> : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-print-hide>
        <CountCard label="Active subcontractors" value={counts.subcontractors} />
        <CountCard label="Active contracts" value={counts.activeContracts} />
        <CountCard
          label="Contracts expiring in 60 days"
          value={counts.expiringContracts}
          tone="warning"
        />
      </div>

      <SearchInput placeholder="Search name, code, or CR number…" />

      {subcontractors.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title={q ? "No matching subcontractors" : "No subcontractors"}
          description={
            q ? "Try a different search term." : "Add a subcontractor to record its contracts."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">CR number</th>
                <th className="px-3 py-2 text-left font-medium">Contact</th>
                <th className="px-3 py-2 text-right font-medium">Contracts</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {subcontractors.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/subcontractors/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{s.crNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    {s.contactPerson ?? <span className="text-muted-foreground">—</span>}
                    {s.phone ? <p className="text-muted-foreground text-xs">{s.phone}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s._count.contracts}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.status === "ACTIVE" ? "default" : "outline"}>
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

function CountCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="gap-0 py-4">
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
  );
}
