import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getSubcontractor } from "@/server/services/vendors";
import { orgOptions } from "@/server/services/org";
import { ContractDialog } from "./contract-dialog";
import { ContractRowActions } from "./contract-row-actions";
import { SubcontractorEditButton } from "./subcontractor-edit-button";
import { SubcontractorArchiveButton } from "./archive-button";

export const metadata: Metadata = { title: "Subcontractor" };

export default async function SubcontractorPage({
  params,
}: {
  params: Promise<{ subcontractorId: string }>;
}) {
  const ctx = await requirePagePermission("subcontractors.view");
  const { subcontractorId } = await params;
  const canManage = ctx.permissions.has("subcontractors.manage");

  const subcontractor = await getSubcontractor(ctx, subcontractorId).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const options = await orgOptions(ctx);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/subcontractors">
              <ArrowLeft />
              All subcontractors
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{subcontractor.name}</h1>
            <p className="text-muted-foreground text-xs">
              <span className="font-mono">{subcontractor.code}</span>
              {subcontractor.crNumber ? ` · CR ${subcontractor.crNumber}` : ""}
              {subcontractor.contactPerson ? ` · ${subcontractor.contactPerson}` : ""}
              {subcontractor.phone ? ` · ${subcontractor.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={subcontractor.status === "ACTIVE" ? "default" : "outline"}>
            {subcontractor.status}
          </Badge>
          {canManage ? (
            <>
              <SubcontractorEditButton
                subcontractor={{
                  id: subcontractor.id,
                  code: subcontractor.code,
                  name: subcontractor.name,
                  contactPerson: subcontractor.contactPerson,
                  phone: subcontractor.phone,
                  email: subcontractor.email,
                  crNumber: subcontractor.crNumber,
                  status: subcontractor.status,
                  notes: subcontractor.notes,
                }}
              />
              <ContractDialog
                subcontractorId={subcontractor.id}
                companies={options.companies}
              />
              {subcontractor.status === "ACTIVE" ? (
                <SubcontractorArchiveButton
                  subcontractor={{
                    id: subcontractor.id,
                    name: subcontractor.name,
                    contractCount: subcontractor.contracts.length,
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {subcontractor.notes ? (
        <p className="text-muted-foreground rounded-lg border p-3 text-sm">
          {subcontractor.notes}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Contracts</h2>

        {subcontractor.contracts.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No contracts recorded for the companies you can see.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Contract no.</th>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Scope</th>
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  {canManage ? <th className="w-10 px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {subcontractor.contracts.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{c.contractNo}</td>
                    <td className="text-muted-foreground px-3 py-2">{c.company.code}</td>
                    <td className="max-w-xs truncate px-3 py-2">{c.scope ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="tabular-nums">
                        {c.startDate.toISOString().slice(0, 10)} →{" "}
                        {c.endDate.toISOString().slice(0, 10)}
                      </span>
                      {c.status === "ACTIVE" ? (
                        <ExpiryAlert date={c.endDate} className="mt-0.5" />
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.value ? `${c.value.toString()} ${c.currency}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={c.status === "ACTIVE" ? "default" : "outline"}>
                        {c.status}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <ContractRowActions
                          contract={{
                            id: c.id,
                            subcontractorId: subcontractor.id,
                            companyId: c.companyId,
                            contractNo: c.contractNo,
                            scope: c.scope,
                            startDate: c.startDate.toISOString().slice(0, 10),
                            endDate: c.endDate.toISOString().slice(0, 10),
                            value: c.value ? c.value.toString() : null,
                            currency: c.currency,
                            status: c.status,
                          }}
                          companies={options.companies}
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
    </PageShell>
  );
}
