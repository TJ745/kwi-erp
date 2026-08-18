import { expect, test as setup } from "@playwright/test";
import { E2E_PASSWORD, ROLES, STORAGE_STATE, type RoleName } from "./roles";

/**
 * Signs each role in through the real login form and saves the session.
 *
 * This is also the login test: it goes through the actual form rather than
 * posting to the auth API, so a broken sign-in fails the whole suite loudly
 * instead of every spec failing mysteriously on a redirect.
 */
for (const role of Object.keys(ROLES) as RoleName[]) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(ROLES[role]);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Landing anywhere inside the shell means the session is real; asserting on
    // the dashboard specifically would couple this to the post-login redirect.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });

    // Proves the session resolves server-side, not just that the URL changed:
    // the app shell only renders for a request that resolved an actor context.
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();

    await page.context().storageState({ path: STORAGE_STATE[role] });
  });
}
