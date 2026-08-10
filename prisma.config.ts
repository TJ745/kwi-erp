import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 does not auto-load .env files. Node's built-in loader is used so we
// avoid a dotenv dependency. Later files win, matching Next.js precedence.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this file.
 *
 * `datasource.url` is used by migrate/studio only, and points at the DIRECT
 * (non-pooled) Neon connection — migrations cannot run over a pooler.
 * The application runtime connects via the Neon driver adapter instead;
 * see src/server/db/client.ts.
 */
export default defineConfig({
  // Multi-file schema: every *.prisma under this folder is loaded.
  schema: "prisma/schema",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
