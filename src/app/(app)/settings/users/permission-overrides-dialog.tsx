"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldMinus, X } from "lucide-react";
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
  removeUserPermissionOverrideAction,
  setUserPermissionOverrideAction,
} from "@/server/actions/users";

export type OverrideRow = {
  key: string;
  label: string;
  effect: string;
  expiresAt: string | null;
};

/**
 * Per-user permission overrides, on top of the role.
 *
 * The permissions offered for ALLOW are only those the actor holds themselves —
 * the server refuses anything else, and offering a control that always fails is
 * worse than not offering it. DENY may target any permission, because removing
 * access is not an escalation.
 */
export function PermissionOverridesDialog({
  open,
  onOpenChange,
  user,
  overrides,
  grantablePermissions,
  allPermissions,
  isSelf,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string; roleKey: string };
  overrides: OverrideRow[];
  /** Permissions the actor holds, and may therefore hand out. */
  grantablePermissions: { key: string; label: string }[];
  allPermissions: { key: string; label: string }[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [effect, setEffect] = React.useState<"ALLOW" | "DENY">("ALLOW");
  const [permissionKey, setPermissionKey] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [reason, setReason] = React.useState("");

  const choices = effect === "ALLOW" ? grantablePermissions : allPermissions;

  // Changing the effect can invalidate the selection — a permission the actor
  // may DENY is not necessarily one they may ALLOW. Derived at render rather
  // than cleared in an effect, which would be an extra render and a lint error.
  const selectedKey = choices.some((c) => c.key === permissionKey) ? permissionKey : "";

  function add() {
    startTransition(async () => {
      const result = await setUserPermissionOverrideAction({
        userId: user.id,
        permissionKey: selectedKey,
        effect,
        expiresAt,
        reason,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${effect === "ALLOW" ? "Granted" : "Denied"} ${selectedKey} for ${user.name}.`,
      );
      setPermissionKey("");
      setExpiresAt("");
      setReason("");
      router.refresh();
    });
  }

  function remove(key: string) {
    startTransition(async () => {
      const result = await removeUserPermissionOverrideAction({
        userId: user.id,
        permissionKey: key,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Override removed; their role decides again.");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permission overrides</DialogTitle>
          <DialogDescription>
            {user.name} inherits {user.roleKey.replace(/_/g, " ")}. Overrides adjust that for
            this person alone. A denial always beats a grant, and an expired override stops
            applying on its own.
          </DialogDescription>
        </DialogHeader>

        {isSelf ? (
          <p className="border-status-warning/40 bg-status-warning/5 rounded-md border p-3 text-sm">
            You cannot change your own permissions.
          </p>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Current overrides</h3>
              {overrides.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  None — this user gets exactly what their role grants.
                </p>
              ) : (
                <ul className="space-y-2">
                  {overrides.map((o) => (
                    <li
                      key={o.key}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          {o.effect === "ALLOW" ? (
                            <ShieldCheck className="text-status-valid size-3.5 shrink-0" />
                          ) : (
                            <ShieldMinus className="text-status-expired size-3.5 shrink-0" />
                          )}
                          <span className="truncate">{o.label}</span>
                        </p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {o.key}
                          {o.expiresAt ? ` · until ${o.expiresAt}` : " · no expiry"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove the ${o.key} override`}
                        disabled={pending}
                        onClick={() => {
                          remove(o.key);
                        }}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Add an override</h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ov-effect">Effect</Label>
                  <Select
                    value={effect}
                    onValueChange={(v) => {
                      setEffect(v === "DENY" ? "DENY" : "ALLOW");
                    }}
                  >
                    <SelectTrigger id="ov-effect" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALLOW">Grant</SelectItem>
                      <SelectItem value="DENY">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ov-expires">Expires</Label>
                  <Input
                    id="ov-expires"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => {
                      setExpiresAt(e.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ov-permission">Permission</Label>
                <Select value={selectedKey} onValueChange={setPermissionKey}>
                  <SelectTrigger id="ov-permission" className="w-full">
                    <SelectValue placeholder="Select a permission" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label} — {p.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {effect === "ALLOW" ? (
                  <p className="text-muted-foreground text-xs">
                    Only permissions you hold yourself can be granted.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ov-reason">Reason</Label>
                <Input
                  id="ov-reason"
                  value={reason}
                  placeholder="Covering for the IT manager until 30 June"
                  onChange={(e) => {
                    setReason(e.target.value);
                  }}
                />
                <p className="text-muted-foreground text-xs">Recorded on the audit entry.</p>
              </div>

              {expiresAt === "" && effect === "ALLOW" ? (
                <p className="text-status-warning text-xs">
                  Without an expiry this grant lasts until someone removes it.
                </p>
              ) : null}
            </section>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Close
          </Button>
          {isSelf ? null : (
            <Button disabled={!selectedKey || pending} onClick={add}>
              {pending ? "Saving…" : effect === "ALLOW" ? "Grant" : "Deny"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
