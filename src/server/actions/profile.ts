"use server";

import { z } from "zod";
import { getSessionToken } from "@/server/auth/context";
import { defineAction } from "./define-action";
import { revokeOtherSessions, updateOwnName } from "@/server/services/profile";

/**
 * Self-service account actions.
 *
 * Gated on `dashboard.view`, which every role holds — these address the caller
 * and nobody else, so a stronger permission would only stop people managing
 * their own account. The services take no target id, so there is nothing to
 * escalate to.
 */

export const updateOwnNameAction = defineAction({
  permission: "dashboard.view",
  schema: z
    .object({ name: z.string().trim().min(2, "Name is required").max(120) })
    .strict(),
  audit: { action: "UPDATE", entity: "USER" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateOwnName(ctx, input.name);
    audit.record({
      entityId: ctx.userId,
      summary: `Updated their own display name`,
      before: { name: before.name },
      after: { name: after.name },
    });
    return { ok: true as const };
  },
  revalidate: () => ["/profile"],
});

export const revokeOtherSessionsAction = defineAction({
  permission: "dashboard.view",
  schema: z.object({}).strict(),
  audit: { action: "UPDATE", entity: "USER" },
  handler: async ({ ctx, audit }) => {
    const token = await getSessionToken();
    const count = await revokeOtherSessions(ctx, token);
    audit.record({
      entityId: ctx.userId,
      summary: `Signed out of ${String(count)} other session(s) and locked the vault`,
      after: { revoked: count },
    });
    return { revoked: count };
  },
  revalidate: () => ["/profile"],
});
