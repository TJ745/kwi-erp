import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

// Argon2 is a native module — this handler cannot run on the edge runtime.
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
