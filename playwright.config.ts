import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * These exist for the seams. The unit suite covers pure logic and the services
 * have been exercised directly, but nothing until now proved that the modules
 * compose — that raising a petty cash request actually surfaces on the
 * approver's screen, or that an unreturned laptop actually blocks an exit.
 *
 * Deliberately serial with one worker: the specs share one database and some
 * of them assert on counts, which parallel runs would make meaningless.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // A failing e2e test is usually a real failure, so no retries locally —
  // a test that only passes on the second attempt is hiding something.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 90_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // Signs each role in through the real login form and stores the session,
    // so the specs start authenticated without re-testing login every time.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    // Reuses a server that is already running, which is the normal case
    // locally; CI starts its own.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },

  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/teardown.ts",
});
