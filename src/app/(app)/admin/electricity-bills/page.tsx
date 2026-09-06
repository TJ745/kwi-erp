import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  accommodationOptions,
  billCounts,
  listBills,
} from "@/server/services/compliance";
import { orgOptions } from "@/server/services/org";
import { BillDialog } from "./bill-dialog";
import { BillRowActions } from "./bill-row-actions";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Electricity Bills" };

export default async function ElectricityBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requirePagePermission("bills.view");
  const { status, q } = await searchParams;
  const canManage = ctx.permissions.has("bills.manage");

  const [bills, counts, accommodations, options] = await Promise.all([
    listBills(ctx, { ...(status ? { status } : {}), ...(q ? { q } : {}) }),
    billCounts(ctx),
    accommodationOptions(ctx),
    orgOptions(ctx),
  ]);

  const today = new Date();

  return (
    <PageShell>
      <PageHeader
        title="Electricity Bills"
        description="Meter readings and payments per location. A bill left unpaid past its due date is shown as overdue whether or not anyone has relabelled it."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="electricity-bills" ctx={ctx} />
            {canManage ? (
              <BillDialog companies={options.companies} accommodations={accommodations} />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Pending" value={String(counts.pending)} />
        <CountCard label="Overdue" value={String(counts.overdue)} tone="expired" />
        <CountCard label="Paid this month" value={String(counts.paidThisMonth)} />
        <CountCard label="Outstanding" value={`${counts.outstandingAmount} SAR`} />
      </div>

      <SearchInput placeholder="Search location or meter number…" />

      {bills.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={q ? "No matching bills" : "No bills recorded"}
          description={
            q ? "Try a different search term." : "Add a bill to track its due date and payment."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Meter</th>
                <th className="px-3 py-2 text-left font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Due</th>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canManage ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                // Derived here, not stored: a PENDING bill past its due date is
                // overdue regardless of whether a job has relabelled it.
                const isOverdue = b.status !== "PAID" && b.dueDate < today;
                return (
                  <tr key={b.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{b.location}</p>
                      {b.accommodation ? (
                        <p className="text-muted-foreground text-xs">
                          {b.accommodation.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{b.meterNumber}</td>
                    <td className="text-muted-foreground px-3 py-2 tabular-nums">
                      {b.billingPeriodStart.toISOString().slice(0, 10)} →{" "}
                      {b.billingPeriodEnd.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.amount.toString()} {b.currency}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn("tabular-nums", isOverdue && "text-status-expired")}
                      >
                        {b.dueDate.toISOString().slice(0, 10)}
                      </span>
                      {b.paidDate ? (
                        <p className="text-muted-foreground text-xs">
                          paid {b.paidDate.toISOString().slice(0, 10)}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{b.company.code}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          b.status === "PAID"
                            ? "default"
                            : isOverdue
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {b.status === "PAID" ? "PAID" : isOverdue ? "OVERDUE" : b.status}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <BillRowActions
                          bill={{
                            id: b.id,
                            companyId: b.companyId,
                            accommodationId: b.accommodationId,
                            location: b.location,
                            meterNumber: b.meterNumber,
                            billingPeriodStart: b.billingPeriodStart
                              .toISOString()
                              .slice(0, 10),
                            billingPeriodEnd: b.billingPeriodEnd.toISOString().slice(0, 10),
                            amount: b.amount.toString(),
                            currency: b.currency,
                            dueDate: b.dueDate.toISOString().slice(0, 10),
                            paidDate: b.paidDate
                              ? b.paidDate.toISOString().slice(0, 10)
                              : null,
                            status: b.status,
                            notes: b.notes,
                          }}
                          companies={options.companies}
                          accommodations={accommodations}
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

function CountCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "expired";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "expired" && value !== "0" && "text-status-expired",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
