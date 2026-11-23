"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";

type Notification = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
};

const SEVERITY_VARIANT: Record<string, "expired" | "warning" | "info"> = {
  CRITICAL: "expired",
  WARNING: "warning",
  INFO: "info",
};

export function NotificationList({
  notifications,
  unreadCount,
  unreadOnly,
}: {
  notifications: Notification[];
  unreadCount: number;
  unreadOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function markOne(id: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction({ id });
      if (result.success) router.refresh();
      else toast.error(result.error);
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction({});
      if (result.success) {
        toast.success(`${String(result.data.count)} marked as read.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              !unreadOnly
                ? "bg-primary text-primary-foreground border-transparent"
                : "hover:bg-accent text-muted-foreground",
            )}
          >
            All
          </Link>
          <Link
            href="/notifications?filter=unread"
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              unreadOnly
                ? "bg-primary text-primary-foreground border-transparent"
                : "hover:bg-accent text-muted-foreground",
            )}
          >
            Unread{unreadCount > 0 ? ` (${String(unreadCount)})` : ""}
          </Link>
        </div>

        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={markAll}>
            <CheckCheck />
            Mark all read
          </Button>
        ) : null}
      </div>

      <ul className="divide-y rounded-lg border">
        {notifications.map((notification) => {
          const Icon = notification.severity === "CRITICAL" ? AlertTriangle : Bell;

          const href =
            notification.entityType === "EMPLOYEE" && notification.entityId
              ? `/people/employees/${notification.entityId}`
              : null;

          const content = (
            <div className="flex items-start gap-3">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  notification.severity === "CRITICAL" && "text-status-expired",
                  notification.severity === "WARNING" && "text-status-warning",
                  notification.severity === "INFO" && "text-status-info",
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm",
                    !notification.isRead && "font-medium",
                  )}
                >
                  {notification.title}
                </p>
                {notification.body ? (
                  <p className="text-muted-foreground text-xs">{notification.body}</p>
                ) : null}
                <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                  {notification.createdAt.slice(0, 16).replace("T", " ")}
                </p>
              </div>
              {!notification.isRead ? (
                <Badge variant={SEVERITY_VARIANT[notification.severity] ?? "info"}>New</Badge>
              ) : null}
            </div>
          );

          return (
            <li
              key={notification.id}
              className={cn("p-4", !notification.isRead && "bg-muted/30")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link href={href} className="block hover:underline">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
                {!notification.isRead ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Mark "${notification.title}" as read`}
                    onClick={() => {
                      markOne(notification.id);
                    }}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
