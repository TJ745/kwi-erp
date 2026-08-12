"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import { markAllRead, markRead } from "@/server/services/notifications";

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
