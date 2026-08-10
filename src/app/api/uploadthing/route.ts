import { createRouteHandler } from "uploadthing/next";
import { getEnv } from "@/lib/env";
import { omsFileRouter } from "./core";

// The middleware calls Prisma and Argon2-backed session lookup, so this cannot
// run on the edge runtime.
export const runtime = "nodejs";

export const { GET, POST } = createRouteHandler({
  router: omsFileRouter,
  config: { token: getEnv().UPLOADTHING_TOKEN },
});
