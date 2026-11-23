"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Lock, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  deleteCredentialAction,
  revealCredentialAction,
  toggleFavoriteAction,
} from "@/server/actions/vault";
import { CredentialDialog } from "./credential-dialog";
import { GrantsDialog, type GrantRow } from "./grants-dialog";

type Credential = {
  id: string;
  name: string;
  categoryName: string;
  categoryId: string;
  companyId: string | null;
  companyCode: string | null;
  username: string | null;
  email: string | null;
  url: string | null;
  isFavorite: boolean;
  lastRotatedAt: string | null;
};

type Company = { id: string; code: string; name: string };

export type CredentialGrants = {
  credentialId: string;
  isRestricted: boolean;
  rows: GrantRow[];
};

/**
 * Credential list with per-row reveal.
 *
 * Revealed values live only in React state for this component instance. They
 * are never written to localStorage or sessionStorage, and are cleared on an
 * inactivity timer and on unmount (docs/SECURITY.md §5.5).
 */
export function CredentialList({
  credentials,
  categories,
  companies,
  canReveal,
  canUpdate,
  canDelete = false,
  canGrant,
  grants,
  grantUsers,
  grantRoles,
  isUnlocked,
  idleMinutes,
}: {
  credentials: Credential[];
  categories: { id: string; name: string }[];
  companies: Company[];
  canReveal: boolean;
  canUpdate: boolean;
  canDelete?: boolean;
  canGrant: boolean;
  grants: CredentialGrants[];
  grantUsers: { id: string; name: string; email: string }[];
  grantRoles: { id: string; name: string }[];
  isUnlocked: boolean;
  idleMinutes: number;
}) {
  const grantsById = new Map(grants.map((g) => [g.credentialId, g]));
  const [revealed, setRevealed] = React.useState<Map<string, string>>(new Map());

  const clearRevealed = React.useCallback(() => {
    setRevealed((prev) => {
      if (prev.size === 0) return prev;
      return new Map();
    });
  }, []);

  // Client-side auto-hide, matching the server's idle window. The server lock
  // is the real control; this stops a value sitting on screen in the meantime.
  React.useEffect(() => {
    if (revealed.size === 0) return;
    const timer = setTimeout(clearRevealed, idleMinutes * 60 * 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [revealed, idleMinutes, clearRevealed]);

  // Hide everything when the tab loses focus — shoulder-surfing and screen
  // sharing are the realistic exposure here.
  React.useEffect(() => {
    function onHidden() {
      if (document.visibilityState === "hidden") clearRevealed();
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [clearRevealed]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Credentials</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Username</th>
            <th className="px-3 py-2 text-left font-medium">Password</th>
            <th className="px-3 py-2 text-left font-medium">URL</th>
            <th className="px-3 py-2 text-left font-medium">Rotated</th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {credentials.map((credential) => (
            <CredentialRow
              key={credential.id}
              credential={credential}
              categories={categories}
              companies={companies}
              canReveal={canReveal}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canGrant={canGrant}
              grants={grantsById.get(credential.id) ?? null}
              grantUsers={grantUsers}
              grantRoles={grantRoles}
              isUnlocked={isUnlocked}
              secret={revealed.get(credential.id) ?? null}
              onRevealed={(secret) => {
                setRevealed((prev) => new Map(prev).set(credential.id, secret));
              }}
              onHidden={() => {
                setRevealed((prev) => {
                  const next = new Map(prev);
                  next.delete(credential.id);
                  return next;
                });
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CredentialRow({
  credential,
  categories,
  companies,
  canReveal,
  canUpdate,
  canDelete,
  canGrant,
  grants,
  grantUsers,
  grantRoles,
  isUnlocked,
  secret,
  onRevealed,
  onHidden,
}: {
  credential: Credential;
  categories: { id: string; name: string }[];
  companies: Company[];
  canReveal: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canGrant: boolean;
  grants: CredentialGrants | null;
  grantUsers: { id: string; name: string; email: string }[];
  grantRoles: { id: string; name: string }[];
  isUnlocked: boolean;
  secret: string | null;
  onRevealed: (secret: string) => void;
  onHidden: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState<"user" | "secret" | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [grantsOpen, setGrantsOpen] = React.useState(false);

  function reveal() {
    startTransition(async () => {
      const result = await revealCredentialAction({ id: credential.id });
      if (result.success) {
        onRevealed(result.data.secret);
      } else {
        toast.error(result.error);
      }
    });
  }

  async function copy(value: string, what: "user" | "secret") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => {
        setCopied(null);
      }, 1500);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  }

  return (
    <tr className="border-t align-middle">
      <td className="px-2 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={credential.isFavorite ? "Remove favourite" : "Add favourite"}
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await toggleFavoriteAction({ credentialId: credential.id });
              router.refresh();
            });
          }}
        >
          <Star
            className={cn(
              "size-4",
              credential.isFavorite && "fill-status-warning text-status-warning",
            )}
          />
        </Button>
      </td>
      <td className="max-w-[16rem] px-3 py-2">
        <p className="truncate font-medium">{credential.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {credential.categoryName}
          {credential.companyCode ? ` · ${credential.companyCode}` : ""}
        </p>
      </td>
      <td className="max-w-[14rem] px-3 py-2">
        {credential.username ? (
          <span className="inline-flex max-w-full items-center gap-1">
            <span className="truncate font-mono text-xs">{credential.username}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy username"
              onClick={() => void copy(credential.username ?? "", "user")}
            >
              {copied === "user" ? <Check className="text-status-valid" /> : <Copy />}
            </Button>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1">
          <span
            className={cn(
              "max-w-[12rem] truncate font-mono text-sm",
              secret ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {secret ?? "••••••••••••"}
          </span>
          {secret ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy password"
                onClick={() => void copy(secret, "secret")}
              >
                {copied === "secret" ? <Check className="text-status-valid" /> : <Copy />}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Hide password" onClick={onHidden}>
                <EyeOff />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reveal password for ${credential.name}`}
              disabled={!canReveal || !isUnlocked || pending}
              title={
                !canReveal
                  ? "You do not have permission to reveal passwords"
                  : !isUnlocked
                    ? "Unlock the vault first"
                    : undefined
              }
              onClick={reveal}
            >
              <Eye />
            </Button>
          )}
        </span>
      </td>
      <td className="max-w-[14rem] px-3 py-2">
        {credential.url ? (
          <a
            href={credential.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground block truncate text-xs underline-offset-4 hover:underline"
          >
            {credential.url.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap tabular-nums">
        {credential.lastRotatedAt ?? "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end">
          {canGrant ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Manage access to ${credential.name}`}
              title={
                grants?.isRestricted
                  ? "Restricted to named grantees"
                  : "Open to everyone with vault access"
              }
              onClick={() => {
                setGrantsOpen(true);
              }}
            >
              {grants?.isRestricted ? <Lock className="text-status-warning" /> : <Users />}
            </Button>
          ) : null}
          {canUpdate ? (
            <CredentialDialog
              mode="edit"
              categories={categories}
              companies={companies}
              credential={{
                id: credential.id,
                name: credential.name,
                categoryId: credential.categoryId,
                companyId: credential.companyId,
                username: credential.username,
                email: credential.email,
                url: credential.url,
              }}
            />
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${credential.name}`}
              onClick={() => {
                setConfirmDelete(true);
              }}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>

        {canGrant ? (
          <GrantsDialog
            open={grantsOpen}
            onOpenChange={setGrantsOpen}
            credential={{ id: credential.id, name: credential.name }}
            grants={grants?.rows ?? []}
            isRestricted={grants?.isRestricted ?? false}
            users={grantUsers}
            roles={grantRoles}
          />
        ) : null}

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{credential.name}”?</DialogTitle>
              <DialogDescription>
                The credential is archived and its encrypted value retained for the audit trail.
                Anyone still using this password should change it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDelete(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await deleteCredentialAction({ id: credential.id });
                    if (result.success) {
                      toast.success("Credential deleted.");
                      setConfirmDelete(false);
                      router.refresh();
                    } else {
                      toast.error(result.error);
                    }
                  });
                }}
              >
                {pending ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
