"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import { markAllRead, markRead,
  listNotifications,
  unreadCount,
} from "@/server/services/notifications";

/**
 * Reading a notification is not audited: it is high-volume, low-value, and
 * would drown the genuinely interesting entries in the audit log.
 */

export const markNotificationReadAction = defineAction({
  permission: "notifications.view",
  schema: z.object({ id: z.string().min(1) }).strict(),
  handler: async ({ input, ctx }) => {
    await markRead(ctx, input.id);
    return { ok: true as const };
  },
  revalidate: () => ["/notifications", "/dashboard"],
});

export const markAllNotificationsReadAction = defineAction({
  permission: "notifications.view",
  schema: z.object({}).strict(),
  handler: async ({ ctx }) => {
    const count = await markAllRead(ctx);
    return { count };
  },
  revalidate: () => ["/notifications", "/dashboard"],
});

/**
 * What the header bell needs: the unread count and the few most recent items.
 *
 * Read-only and scoped to the caller by the service, so it needs no permission
 * beyond being signed in — a notification is already addressed to one user.
 */
export const notificationSummaryAction = defineAction({
  permission: "dashboard.view",
  schema: z.object({}).strict(),
  handler: async ({ ctx }) => {
    const [unread, items] = await Promise.all([
      unreadCount(ctx),
      listNotifications(ctx, { limit: 6 }),
    ]);

    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        severity: n.severity,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  },
});
