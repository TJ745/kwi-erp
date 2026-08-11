import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws on import outside a React Server Component. It
      // exists to stop server code reaching a CLIENT BUNDLE — not to stop
      // tests. Stubbing it lets us unit-test service logic directly; the real
      // protection is unaffected because Next resolves the true package.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
