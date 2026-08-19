"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Monitor } from "lucide-react";
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
import { revokeOtherSessionsAction } from "@/server/actions/profile";

export type SessionRow = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
};

/** Turns a user-agent string into something a person can recognise. */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Chrome\//.test(agent)
      ? "Chrome"
      : /Safari\//.test(agent)
        ? "Safari"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : "Browser";
  const os = /Windows/.test(agent)
    ? "Windows"
    : /Macintosh|Mac OS/.test(agent)
      ? "macOS"
      : /Android/.test(agent)
        ? "Android"
        : /iPhone|iPad/.test(agent)
          ? "iOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Active sessions, and the way out of a stolen one.
 *
 * The current session is kept when signing out everywhere else: locking
 * yourself out mid-panic is how people learn not to press the button.
 */
export function Sessions({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const others = sessions.filter((s) => !s.isCurrent).length;

  function revoke() {
    startTransition(async () => {
      const result = await revokeOtherSessionsAction({});
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.revoked === 0
          ? "No other sessions were active."
          : `Signed out of ${String(result.data.revoked)} other session(s).`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Monitor className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{describeAgent(s.userAgent)}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {s.ipAddress ?? "IP not recorded"} · last used {s.updatedAt}
                </p>
              </div>
            </div>
            {s.isCurrent ? <Badge>This device</Badge> : null}
          </li>
        ))}
      </ul>

      {others > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            setOpen(true);
          }}
        >
          <LogOut />
          Sign out of other sessions ({others})
        </Button>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">
          This is your only active session.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out everywhere else?</DialogTitle>
            <DialogDescription>
              Every other browser and device is signed out immediately, and the vault is
              locked. This session stays signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={revoke}>
              {pending ? "Signing out…" : "Sign out everywhere else"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
