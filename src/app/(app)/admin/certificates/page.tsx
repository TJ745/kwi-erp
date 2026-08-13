import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  certificateCounts,
  certificateTypes,
  listCertificates,
} from "@/server/services/compliance";
import { orgOptions } from "@/server/services/org";
import { CertificateDialog } from "./certificate-dialog";
import { CertificateRowActions } from "./certificate-row-actions";

export const metadata: Metadata = { title: "Company Certificates" };

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; typeId?: string }>;
}) {
  const ctx = await requirePagePermission("certificates.view");
  const { status, typeId } = await searchParams;
  const canManage = ctx.permissions.has("certificates.manage");

  const [certificates, types, counts, options] = await Promise.all([
    listCertificates(ctx, {
      ...(status ? { status } : {}),
      ...(typeId ? { typeId } : {}),
    }),
    certificateTypes(),
    certificateCounts(ctx),
    orgOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Company Certificates"
        description="CR, VAT, GOSI, Zakat and the rest. Active certificates feed the expiry register, so renewals surface on the dashboard and in reminders."
        action={
          canManage ? (
            <CertificateDialog companies={options.companies} types={types} />
          ) : null
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <CountCard label="Active" value={counts.total} />
        <CountCard label="Expiring in 60 days" value={counts.expiringSoon} tone="warning" />
        <CountCard label="Expired" value={counts.expired} tone="expired" />
      </div>

      {certificates.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No certificates"
          description="Record a certificate to track its renewal date."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Number</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Issued</th>
                <th className="px-3 py-2 text-left font-medium">Expiry</th>
                <th className="px-3 py-2 text-left font-medium">Authority</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {certificates.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{c.certificateType.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.certificateNo}</td>
                  <td className="text-muted-foreground px-3 py-2">{c.company.code}</td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">
                    {c.issueDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="tabular-nums">
                      {c.expiryDate.toISOString().slice(0, 10)}
                    </span>
                    {c.status === "ACTIVE" ? (
                      <ExpiryAlert date={c.expiryDate} className="mt-0.5" />
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {c.issuingAuthority ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={c.status === "ACTIVE" ? "default" : "outline"}>
                      {c.status}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <CertificateRowActions
                        certificate={{
                          id: c.id,
                          companyId: c.companyId,
                          certificateTypeId: c.certificateTypeId,
                          certificateNo: c.certificateNo,
                          issueDate: c.issueDate.toISOString().slice(0, 10),
                          expiryDate: c.expiryDate.toISOString().slice(0, 10),
                          issuingAuthority: c.issuingAuthority,
                          status: c.status,
                          notes: c.notes,
                        }}
                        companies={options.companies}
                        types={types}
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

function CountCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "expired";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            value > 0 && tone === "warning" && "text-status-warning",
            value > 0 && tone === "expired" && "text-status-expired",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
