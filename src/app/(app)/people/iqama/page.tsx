import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { IQAMA_BUCKETS } from "@/lib/expiry";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { expiryBuckets, listExpiring } from "@/server/services/expiry";

export const metadata: Metadata = { title: "Iqama & Passports" };

/**
 * The daily expiry workspace required by brief §11 — buckets at 7/15/30/60/90
 * days plus already-expired. Reads the ExpiryIndex projection, so this is one
 * indexed query rather than a scan across Iqama and passport tables.
 */
export default async function IqamaPage({
  searchParams,
}: {
  searchParams: Promise<{ within?: string }>;
}) {
  const ctx = await requirePagePermission("employees.view");
  const { within } = await searchParams;

  const parsed = Number(within);
  const activeBucket = IQAMA_BUCKETS.includes(parsed as (typeof IQAMA_BUCKETS)[number])
    ? parsed
    : 90;

  const sources = ["IQAMA", "PASSPORT"] as const;

  const [buckets, items] = await Promise.all([
    expiryBuckets(ctx, IQAMA_BUCKETS, [...sources]),
    listExpiring(ctx, { withinDays: activeBucket, sources: [...sources], limit: 200 }),
  ]);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Iqama & Passports"
        description="Residency and travel document expiry across your companies."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <BucketCard
          label="Expired"
          count={buckets.expired}
          tone="expired"
          href="/people/iqama"
          active={false}
        />
        {buckets.buckets.map((bucket) => (
          <BucketCard
            key={bucket.days}
            label={`${bucket.days} days`}
            count={bucket.count}
            tone={bucket.days <= 15 ? "warning" : "neutral"}
            href={`/people/iqama?within=${String(bucket.days)}`}
            active={activeBucket === bucket.days}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing expiring in this window"
          description="Add Iqama or passport records to employees, and their expiry dates appear here automatically."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Expiring identity documents</caption>
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Document</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Expiry</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">
                    {item.employeeId ? (
                      <Link
                        href={`/people/employees/${item.employeeId}`}
                        className="font-medium hover:underline"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      item.label
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">
                    {item.source === "IQAMA" ? "Iqama" : "Passport"}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {item.expiryDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2">
                    <ExpiryAlert date={item.expiryDate} />
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

function BucketCard({
  label,
  count,
  tone,
  href,
  active,
}: {
  label: string;
  count: number;
  tone: "expired" | "warning" | "neutral";
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          "gap-0 py-4 transition-colors",
          active && "ring-ring ring-2",
          count > 0 && tone === "expired" && "border-status-expired/40",
          count > 0 && tone === "warning" && "border-status-warning/40",
        )}
      >
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              count > 0 && tone === "expired" && "text-status-expired",
              count > 0 && tone === "warning" && "text-status-warning",
            )}
          >
            {count}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
