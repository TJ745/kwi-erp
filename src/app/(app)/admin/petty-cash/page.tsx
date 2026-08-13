import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { formatAmount } from "@/lib/petty-cash";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listAccounts, pendingApprovals } from "@/server/services/petty-cash";
import { orgOptions } from "@/server/services/org";
import { AccountDialog } from "./account-dialog";
import { ApprovalRow } from "./approval-row";

export const metadata: Metadata = { title: "Petty Cash" };

export default async function PettyCashPage() {
  const ctx = await requirePagePermission("pettycash.view");
  const canApprove = ctx.permissions.has("pettycash.approve");

  const [accounts, pending, options] = await Promise.all([
    listAccounts(ctx),
    canApprove ? pendingApprovals(ctx) : Promise.resolve([]),
    orgOptions(ctx),
  ]);

  const totalHeld = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.balance.current, 0);

  return (
    <PageShell>
      <PageHeader
        title="Petty Cash"
        description="Balances are computed from the ledger, never stored — the figure shown is always the one the transactions justify. Only approved entries move it."
        action={<AccountDialog companies={options.companies} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Held across active accounts" value={formatAmount(totalHeld)} />
        <StatCard label="Active accounts" value={String(accounts.filter((a) => a.isActive).length)} />
        <StatCard
          label="Pending requests"
          value={String(pending.length)}
          tone={pending.length > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Committed if all approved"
          value={formatAmount(
            accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balance.projected, 0),
          )}
        />
      </div>

      {canApprove && pending.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Awaiting approval</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Account</th>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="w-44 px-3 py-2 text-left font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => (
                  <ApprovalRow
                    key={t.id}
                    transaction={{
                      id: t.id,
                      date: t.date.toISOString().slice(0, 10),
                      accountName: t.account.name,
                      description: t.description,
                      categoryName: t.category.name,
                      amount: t.amount.toString(),
                      currency: t.currency,
                      type: t.type,
                      requesterName: t.requester?.fullName ?? null,
                      // Self-approval is refused server-side; the UI reflects
                      // that rather than offering a button that will fail.
                      isOwnRequest: t.createdById === ctx.userId,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Accounts</h2>

        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No petty cash accounts"
            description="Open an account to start recording income and expenses."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <Link key={a.id} href={`/admin/petty-cash/${a.id}`}>
                <Card className="hover:border-foreground/20 h-full gap-0 py-4 transition-colors">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {a.companyCode} · {a.transactionCount} entries
                        </p>
                      </div>
                      {!a.isActive ? <Badge variant="outline">Closed</Badge> : null}
                    </div>

                    <div>
                      <p className="text-muted-foreground text-xs">Balance</p>
                      <p
                        className={cn(
                          "text-xl font-semibold tabular-nums",
                          a.balance.current < 0 && "text-status-expired",
                        )}
                      >
                        {formatAmount(a.balance.current, a.currency)}
                      </p>
                    </div>

                    {a.balance.pendingOut > 0 ? (
                      <p className="text-status-warning text-xs">
                        {formatAmount(a.balance.pendingOut, a.currency)} pending →{" "}
                        {formatAmount(a.balance.projected, a.currency)} if approved
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "warning" && "text-status-warning",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
