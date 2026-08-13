import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-header";
import { AppError } from "@/lib/result";
import { formatAmount } from "@/lib/petty-cash";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  cashCategories,
  getAccount,
  listEmployeesForCompany,
} from "@/server/services/petty-cash";

import { TransactionDialog } from "./transaction-dialog";
import { TransactionRowActions } from "./transaction-row-actions";

export const metadata: Metadata = { title: "Petty Cash Account" };

export default async function PettyCashAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const ctx = await requirePagePermission("pettycash.view");
  const { accountId } = await params;
  const canCreate = ctx.permissions.has("pettycash.create");
  const canApprove = ctx.permissions.has("pettycash.approve");

  const account = await getAccount(ctx, accountId).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  const [categories, employees] = await Promise.all([
    cashCategories(),
    canCreate ? listEmployeesForCompany(ctx, account.companyId) : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/petty-cash">
              <ArrowLeft />
              All accounts
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{account.name}</h1>
            <p className="text-muted-foreground text-xs">
              {account.company.code} · opening balance{" "}
              {formatAmount(Number(account.openingBalanceText), account.currency)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!account.isActive ? <Badge variant="outline">Closed</Badge> : null}
          {canCreate && account.isActive ? (
            <TransactionDialog
              accountId={account.id}
              currency={account.currency}
              categories={categories}
              employees={employees}
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Current balance"
          value={formatAmount(account.balance.current, account.currency)}
          tone={account.balance.current < 0 ? "expired" : "neutral"}
        />
        <StatCard
          label="Total in (approved)"
          value={formatAmount(account.balance.totalIn, account.currency)}
        />
        <StatCard
          label="Total out (approved)"
          value={formatAmount(account.balance.totalOut, account.currency)}
        />
        <StatCard
          label="Pending out"
          value={formatAmount(account.balance.pendingOut, account.currency)}
          tone={account.balance.pendingOut > 0 ? "warning" : "neutral"}
        />
      </div>

      {account.balance.projected < 0 ? (
        <p
          role="alert"
          className="border-status-warning/40 bg-status-warning/5 rounded-md border p-3 text-sm"
        >
          Approving every pending request would overdraw this account to{" "}
          {formatAmount(account.balance.projected, account.currency)}. The approval step
          refuses an overdraft, so some of these will have to be rejected or the account
          topped up first.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ledger</h2>

        {account.transactions.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Method</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  {canCreate || canApprove ? <th className="w-10 px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {account.transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="text-muted-foreground px-3 py-2 tabular-nums">
                      {t.date.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <p>{t.description}</p>
                      {t.requester ? (
                        <p className="text-muted-foreground text-xs">
                          for {t.requester.fullName}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{t.category.name}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {t.paymentMethod.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        className={cn(
                          t.type === "EXPENSE" ? "text-status-expired" : "text-status-valid",
                          // Only approved entries have moved the balance; a
                          // pending one is dimmed so the ledger reads honestly.
                          t.status !== "APPROVED" && "opacity-50",
                        )}
                      >
                        {t.type === "EXPENSE" ? "−" : "+"}
                        {t.amount.toString()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          t.status === "APPROVED"
                            ? "default"
                            : t.status === "REJECTED"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    {canCreate || canApprove ? (
                      <td className="px-3 py-2">
                        {t.status === "PENDING" ? (
                          <TransactionRowActions
                            transaction={{
                              id: t.id,
                              accountId: account.id,
                              date: t.date.toISOString().slice(0, 10),
                              type: t.type,
                              categoryId: t.categoryId,
                              description: t.description,
                              amount: t.amount.toString(),
                              paymentMethod: t.paymentMethod,
                              requesterId: t.requesterId,
                              notes: t.notes,
                              isOwnRequest: t.createdById === ctx.userId,
                            }}
                            currency={account.currency}
                            categories={categories}
                            employees={employees}
                            canApprove={canApprove}
                            canEdit={canCreate}
                          />
                        ) : null}
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

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "expired";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            tone === "warning" && "text-status-warning",
            tone === "expired" && "text-status-expired",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
