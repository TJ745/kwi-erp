"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  notificationSummaryAction,
} from "@/server/actions/notifications";

type Item = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * The header bell.
 *
 * Polled every 60 seconds, not pushed. That is a deliberate limit rather than
 * an unfinished one: this system has no websocket or SSE transport, and adding
 * one for a badge would be a large amount of infrastructure for a number that
 * is rarely urgent to the second. It also refreshes whenever the tab regains
 * focus, which is when somebody is actually looking.
 *
 * The count is the notification's own — every row is addressed to one user, so
 * there is nothing to scope here beyond being signed in.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<Item[]>([]);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(() => {
    void notificationSummaryAction({}).then((result) => {
      if (!result.success) return;
      setUnread(result.data.unread);
      setItems(result.data.items);
    });
  }, []);

  React.useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);

    // A background tab does not need polling, and somebody returning to the
    // window is exactly when a stale badge is most noticeable.
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  function openItem(item: Item) {
    setOpen(false);
    if (item.readAt === null) {
      startTransition(async () => {
        await markNotificationReadAction({ id: item.id });
        load();
        router.refresh();
      });
    }
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction({});
      load();
      router.refresh();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={
            unread > 0
              ? `Notifications, ${String(unread)} unread`
              : "Notifications, none unread"
          }
        >
          <Bell />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="bg-status-expired text-background absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={pending}
              onClick={markAll}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            Nothing yet. Expiry reminders and approvals appear here.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href="/notifications"
                  onClick={() => {
                    openItem(item);
                  }}
                  className={cn(
                    "hover:bg-muted/60 block border-b px-3 py-2 last:border-b-0",
                    item.readAt === null && "bg-muted/30",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        item.readAt === null ? "bg-status-info" : "bg-transparent",
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-sm",
                          item.readAt === null ? "font-medium" : "text-muted-foreground",
                        )}
                      >
                        {item.title}
                      </p>
                      {item.body ? (
                        <p className="text-muted-foreground truncate text-xs">{item.body}</p>
                      ) : null}
                      <p className="text-muted-foreground text-[11px]">
                        {item.createdAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t px-3 py-2">
          <Link
            href="/notifications"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            onClick={() => {
              setOpen(false);
            }}
          >
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
