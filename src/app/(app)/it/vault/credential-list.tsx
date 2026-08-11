"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Credential = {
  id: string;
  name: string;
  categoryName: string;
  companyCode: string | null;
  username: string | null;
  url: string | null;
  isFavorite: boolean;
  lastRotatedAt: string | null;
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
  canReveal,
  isUnlocked,
  idleMinutes,
}: {
  credentials: Credential[];
  canReveal: boolean;
  isUnlocked: boolean;
  idleMinutes: number;
}) {
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {credentials.map((credential) => (
        <CredentialCard
          key={credential.id}
          credential={credential}
          canReveal={canReveal}
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
    </div>
  );
}

function CredentialCard({
  credential,
  canReveal,
  isUnlocked,
  secret,
  onRevealed,
  onHidden,
}: {
  credential: Credential;
  canReveal: boolean;
  isUnlocked: boolean;
  secret: string | null;
  onRevealed: (secret: string) => void;
  onHidden: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState<"user" | "secret" | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{credential.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {credential.categoryName}
              {credential.companyCode ? ` · ${credential.companyCode}` : ""}
            </p>
          </div>
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
        </div>

        {credential.username ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground truncate font-mono text-xs">
              {credential.username}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy username"
              onClick={() => void copy(credential.username ?? "", "user")}
            >
              {copied === "user" ? <Check className="text-status-valid" /> : <Copy />}
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate font-mono text-sm",
              secret ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {secret ?? "••••••••••••"}
          </span>

          <div className="flex shrink-0 items-center gap-1">
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Hide password"
                  onClick={onHidden}
                >
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
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {credential.url ? (
            <a
              href={credential.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground truncate text-xs underline-offset-4 hover:underline"
            >
              {credential.url.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span />
          )}
          {credential.lastRotatedAt ? (
            <Badge variant="neutral" className="shrink-0">
              Rotated {credential.lastRotatedAt}
            </Badge>
          ) : null}
        </div>
      </CardContent>

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
    </Card>
  );
}
