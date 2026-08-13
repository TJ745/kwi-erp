import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { licenceKeyOptions, listLicences } from "@/server/services/infrastructure";
import { orgOptions } from "@/server/services/org";
import { LicenceControls } from "./licence-controls";

export const metadata: Metadata = { title: "Software & Licences" };

export default async function SoftwarePage() {
  const ctx = await requirePagePermission("it.infrastructure.view");
  const canManage = ctx.permissions.has("it.infrastructure.manage");

  const [licences, credentials, options] = await Promise.all([
    listLicences(ctx),
    licenceKeyOptions(ctx),
    orgOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Software & Licences"
        description="Seats owned versus seats deployed, and renewal dates. Licence keys are never stored here — a licence links to a vault credential, and the key is only ever revealed through the vault's own flow."
        action={
          canManage ? (
            <LicenceControls
              companies={options.companies}
              credentials={credentials}
              mode="create"
            />
          ) : null
        }
      />

      {licences.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No licences"
          description="Record a licence to track its seats and renewal date."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Software</th>
                <th className="px-3 py-2 text-left font-medium">Vendor</th>
                <th className="px-3 py-2 text-right font-medium">Seats</th>
                <th className="px-3 py-2 text-left font-medium">Key</th>
                <th className="px-3 py-2 text-left font-medium">Expiry</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {licences.map((l) => {
                const full = l.seatsUsed >= l.seats;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{l.name}</td>
                    <td className="text-muted-foreground px-3 py-2">{l.vendor ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={cn(full && "text-status-warning font-medium")}>
                        {l.seatsUsed}/{l.seats}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {l.licenseKey ? (
                        // The credential's NAME, linking to the vault. The key
                        // itself is never read by this page.
                        <Link
                          href="/it/vault"
                          className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          <KeyRound className="size-3" aria-hidden="true" />
                          {l.licenseKey.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not linked</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.expiryDate ? (
                        <>
                          <span className="tabular-nums">
                            {l.expiryDate.toISOString().slice(0, 10)}
                          </span>
                          <ExpiryAlert date={l.expiryDate} className="mt-0.5" />
                        </>
                      ) : (
                        <Badge variant="outline">Perpetual</Badge>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{l.company.code}</td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <LicenceControls
                          companies={options.companies}
                          credentials={credentials}
                          mode="row"
                          values={{
                            id: l.id,
                            companyId: l.companyId,
                            name: l.name,
                            vendor: l.vendor,
                            licenseKeyCredentialId: l.licenseKeyCredentialId,
                            seats: String(l.seats),
                            seatsUsed: String(l.seatsUsed),
                            purchaseDate: l.purchaseDate
                              ? l.purchaseDate.toISOString().slice(0, 10)
                              : "",
                            expiryDate: l.expiryDate
                              ? l.expiryDate.toISOString().slice(0, 10)
                              : "",
                            notes: l.notes,
                          }}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
