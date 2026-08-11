import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePagePermission } from "@/server/auth/page-guards";
import { assignableEmployees, getAsset } from "@/server/services/assets";
import { orgOptions } from "@/server/services/org";
import { AssetDialog } from "../asset-dialog";
import { AssetHandover } from "./asset-handover";

export const metadata: Metadata = { title: "Asset" };

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const ctx = await requirePagePermission("it.assets.view");
  const { assetId } = await params;
  const asset = await getAsset(ctx, assetId);

  const canManage = ctx.permissions.has("it.assets.manage");
  const canAssign = ctx.permissions.has("it.assets.assign");

  const [employees, options] = await Promise.all([
    canAssign ? assignableEmployees(ctx, asset.companyId) : Promise.resolve([]),
    canManage ? orgOptions(ctx) : Promise.resolve(null),
  ]);

  const current = asset.assignments.find((a) => a.returnedAt === null);
  const history = asset.assignments.filter((a) => a.returnedAt !== null);

  return (
    <PageShell>
      <Link
        href="/it/assets"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to assets
      </Link>

      <PageHeader
        title={`${asset.brand} ${asset.model}`}
        description={`${asset.assetCode} · ${asset.type.replace(/_/g, " ").toLowerCase()} · ${asset.company.code}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={asset.status} />
            {canManage && options ? (
              <AssetDialog
                companies={options.companies}
                asset={{
                  id: asset.id,
                  companyId: asset.companyId,
                  type: asset.type,
                  brand: asset.brand,
                  model: asset.model,
                  serialNumber: asset.serialNumber,
                  assetTag: asset.assetTag,
                  purchaseDate: asset.purchaseDate
                    ? asset.purchaseDate.toISOString().slice(0, 10)
                    : null,
                  purchaseCost: asset.purchaseCost ? asset.purchaseCost.toString() : null,
                  warrantyExpiry: asset.warrantyExpiry
                    ? asset.warrantyExpiry.toISOString().slice(0, 10)
                    : null,
                  condition: asset.condition,
                  location: asset.location,
                  notes: asset.notes,
                }}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <Detail label="Serial number" value={asset.serialNumber} mono />
              <Detail label="Asset tag" value={asset.assetTag} mono />
              <Detail label="Condition" value={asset.condition.toLowerCase()} />
              <Detail label="Location" value={asset.location} />
              <Detail
                label="Purchased"
                value={asset.purchaseDate ? asset.purchaseDate.toISOString().slice(0, 10) : null}
              />
              <div>
                <dt className="text-muted-foreground text-xs">Warranty</dt>
                <dd className="mt-0.5">
                  {asset.warrantyExpiry ? (
                    <ExpiryAlert date={asset.warrantyExpiry} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            </dl>
            {asset.notes ? (
              <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
                {asset.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <AssetHandover
            assetId={asset.id}
            assetCode={asset.assetCode}
            canAssign={canAssign}
            employees={employees}
            current={
              current
                ? {
                    employeeName: current.employee.fullName,
                    employeeNo: current.employee.employeeNo,
                    employeeId: current.employee.id,
                    assignedAt: current.assignedAt.toISOString().slice(0, 10),
                    conditionOut: current.conditionOut,
                    accessories: accessoriesText(current.accessoriesOut),
                    remarks: current.remarksOut,
                  }
                : null
            }
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Handover history{history.length > 0 ? ` (${String(history.length)})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No previous handovers recorded.
                </p>
              ) : (
                <ul className="divide-y">
                  {history.map((h) => (
                    <li key={h.id} className="py-3 first:pt-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/people/employees/${h.employee.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {h.employee.fullName}
                        </Link>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {h.assignedAt.toISOString().slice(0, 10)} →{" "}
                          {h.returnedAt?.toISOString().slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Out: {h.conditionOut.toLowerCase()}
                        {h.conditionIn ? ` · In: ${h.conditionIn.toLowerCase()}` : ""}
                        {accessoriesText(h.missingAccessories)
                          ? ` · Missing: ${accessoriesText(h.missingAccessories) ?? ""}`
                          : ""}
                      </p>
                      {h.remarksIn ? (
                        <p className="mt-1 text-sm">{h.remarksIn}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>
        {value ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

/** Accessories are stored as Json; read defensively rather than trusting shape. */
function accessoriesText(value: unknown): string | null {
  if (value === null || typeof value !== "object") return null;
  const items = (value as Record<string, unknown>).items;
  return typeof items === "string" ? items : null;
}
