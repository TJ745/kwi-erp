"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCredentialGrantAction,
  revokeCredentialGrantAction,
} from "@/server/actions/vault";

export type GrantRow = {
  id: string;
  level: string;
  expiresAt: string | null;
  scope: "CREDENTIAL" | "CATEGORY";
  categoryName: string | null;
  subject: { kind: "USER" | "ROLE"; id: string; label: string; detail: string | null };
};

const LEVELS = [
  { value: "READ", label: "Read — see that it exists" },
  { value: "REVEAL", label: "Reveal — see the password" },
  { value: "MANAGE", label: "Manage — edit, rotate, and grant" },
] as const;

/**
 * Per-credential access control.
 *
 * The wording matters more than usual here. A grant NARROWS access: with none,
 * everyone holding the vault permission can reach the credential; with one,
 * only the people named can. Administrators are not exempt. Someone who assumes
 * "grant" means "give access to one more person" would quietly cut everyone
 * else off, so the dialog states the direction before the first grant is added.
 */
export function GrantsDialog({
  open,
  onOpenChange,
  credential,
  grants,
  isRestricted,
  users,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: { id: string; name: string };
  grants: GrantRow[];
  isRestricted: boolean;
  users: { id: string; name: string; email: string }[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [subjectKind, setSubjectKind] = React.useState<"USER" | "ROLE">("USER");
  const [subjectId, setSubjectId] = React.useState("");
  const [level, setLevel] = React.useState<string>("READ");
  const [expiresAt, setExpiresAt] = React.useState("");

  const choices =
    subjectKind === "USER"
      ? users.map((u) => ({ value: u.id, label: `${u.name} — ${u.email}` }))
      : roles.map((r) => ({ value: r.id, label: r.name }));

  // Switching between people and roles invalidates the selection; derived at
  // render rather than cleared in an effect.
  const selectedSubject = choices.some((c) => c.value === subjectId) ? subjectId : "";

  function add() {
    startTransition(async () => {
      const result = await createCredentialGrantAction({
        credentialId: credential.id,
        subjectKind,
        subjectId: selectedSubject,
        level: level as "READ",
        expiresAt,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Grant added.");
      setSubjectId("");
      setExpiresAt("");
      router.refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeCredentialGrantAction({ id, credentialId: credential.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Grant revoked.");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who can reach “{credential.name}”</DialogTitle>
          <DialogDescription>
            {isRestricted
              ? "This credential is restricted: only the people and roles listed below can reach it, whatever else they hold."
              : "This credential is open to everyone holding the vault permission. Adding the first grant restricts it to the people you name — including administrators, who are not exempt."}
          </DialogDescription>
        </DialogHeader>

        <div
          className={
            isRestricted
              ? "border-status-warning/40 bg-status-warning/5 flex items-start gap-2 rounded-md border p-3 text-xs"
              : "flex items-start gap-2 rounded-md border border-dashed p-3 text-xs"
          }
        >
          {isRestricted ? (
            <Lock className="text-status-warning mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Users className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          )}
          <p className="text-muted-foreground">
            A grant narrows access rather than widening it. There is no administrator
            override, so at least one person must always keep <strong>Manage</strong> — the
            server refuses any change that would leave nobody.
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Current grants</h3>
          {grants.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              None. Anyone with the vault permission can reach this credential.
            </p>
          ) : (
            <ul className="space-y-2">
              {grants.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <ShieldCheck className="text-status-valid size-3.5 shrink-0" />
                      <span className="truncate">{g.subject.label}</span>
                      <Badge variant="outline">{g.level}</Badge>
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {g.subject.kind === "ROLE" ? "Role" : g.subject.detail}
                      {g.scope === "CATEGORY"
                        ? ` · via the ${g.categoryName ?? "category"} category`
                        : ""}
                      {g.expiresAt ? ` · until ${g.expiresAt}` : ""}
                    </p>
                  </div>

                  {g.scope === "CATEGORY" ? (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      Managed on the category
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Revoke the grant for ${g.subject.label}`}
                      disabled={pending}
                      onClick={() => {
                        revoke(g.id);
                      }}
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-medium">Add a grant</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="grant-kind">Give access to</Label>
              <Select
                value={subjectKind}
                onValueChange={(v) => {
                  setSubjectKind(v === "ROLE" ? "ROLE" : "USER");
                }}
              >
                <SelectTrigger id="grant-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">A person</SelectItem>
                  <SelectItem value="ROLE">A role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-level">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="grant-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-subject">
              {subjectKind === "USER" ? "Person" : "Role"}
            </Label>
            <Select value={selectedSubject} onValueChange={setSubjectId}>
              <SelectTrigger id="grant-subject" className="w-full">
                <SelectValue placeholder={subjectKind === "USER" ? "Select a person" : "Select a role"} />
              </SelectTrigger>
              <SelectContent>
                {choices.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-expires">Expires</Label>
            <Input
              id="grant-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => {
                setExpiresAt(e.target.value);
              }}
            />
            <p className="text-muted-foreground text-xs">
              Optional. An expired grant stops applying on its own, which may return the
              credential to open if it was the only one.
            </p>
          </div>

          {!isRestricted ? (
            <p className="text-status-warning text-xs">
              This will be the first grant, so everyone not named here loses access to this
              credential.
            </p>
          ) : null}
        </section>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Close
          </Button>
          <Button disabled={!selectedSubject || pending} onClick={add}>
            {pending ? "Saving…" : "Add grant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
