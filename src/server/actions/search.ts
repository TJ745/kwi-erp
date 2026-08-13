"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import { globalSearch } from "@/server/services/search";

/**
 * Global search.
 *
 * An action rather than a route handler because it returns JSON to a client
 * component that already holds a session. Deliberately NOT audited per
 * keystroke: an audit row for every character typed would bury the entries
 * that matter under noise, and the search reveals nothing the actor could not
 * already list.
 */
export const globalSearchAction = defineAction({
  permission: "search.global",
  schema: z.object({ query: z.string().max(100) }).strict(),
  handler: async ({ input, ctx }) => globalSearch(ctx, input.query),
});
