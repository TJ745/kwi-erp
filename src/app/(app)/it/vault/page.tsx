import type { Metadata } from "next";
import { KeyRound, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  credentialCategories,
  listCredentials,
} from "@/server/services/vault/credentials";
import { isVaultUnlocked, VAULT_IDLE_MINUTES } from "@/server/services/vault/session";
import { CredentialDialog } from "./credential-dialog";
import { CredentialList } from "./credential-list";
import { VaultLock } from "./vault-lock";

export const metadata: Metadata = {
  title: "Password Vault",
  // Belt and braces on top of the app-wide setting.
  robots: { index: false, follow: false },
};

/**
 * Password vault — docs/SECURITY.md §5.
 *
 * Holding vault.view lists credentials; revealing one additionally requires
 * vault.reveal AND an unlocked vault. The list never carries encrypted
 * material, let alone plaintext.
 */
export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const ctx = await requirePagePermission("vault.view");
  const { category, q } = await searchParams;

  const [unlocked, credentials, categories] = await Promise.all([
    isVaultUnlocked(ctx),
    listCredentials(ctx, { categoryId: category, q }),
    credentialCategories(),
  ]);

  const canReveal = ctx.permissions.has("vault.reveal");
  const canCreate = ctx.permissions.has("vault.create");

  return (
    <PageShell>
      <PageHeader
        title="Password Vault"
        description="Company-managed credentials. Passwords are encrypted at rest and every reveal is recorded."
        action={
          <div className="flex items-center gap-2">
            <VaultLock unlocked={unlocked} canReveal={canReveal} />
            {canCreate ? (
              <CredentialDialog
                categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              />
            ) : null}
          </div>
        }
      />

      {!canReveal ? (
        <Card className="border-status-info/40">
          <CardContent className="flex items-start gap-3 px-4 py-3 text-sm">
            <ShieldAlert className="text-status-info mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground">
              You can see which credentials exist, but not their values. Revealing a password
              requires the <code className="text-foreground">vault.reveal</code> permission.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {credentials.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials"
          description="Store government portal, company portal, server, and network credentials here rather than in a spreadsheet."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c._count.credentials > 0)
              .map((c) => (
                <Badge key={c.id} variant={category === c.id ? "default" : "outline"}>
                  {c.name} · {c._count.credentials}
                </Badge>
              ))}
          </div>

          <CredentialList
            credentials={credentials.map((c) => ({
              id: c.id,
              name: c.name,
              categoryName: c.categoryName,
              companyCode: c.companyCode,
              username: c.username,
              url: c.url,
              isFavorite: c.isFavorite,
              lastRotatedAt: c.lastRotatedAt
                ? c.lastRotatedAt.toISOString().slice(0, 10)
                : null,
            }))}
            canReveal={canReveal}
            isUnlocked={unlocked}
            idleMinutes={VAULT_IDLE_MINUTES}
          />
        </>
      )}
    </PageShell>
  );
}
