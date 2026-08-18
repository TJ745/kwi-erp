import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "./roles";

/**
 * Permission boundaries, exercised through a browser.
 *
 * These have been checked before with curl, but only against the Server Action
 * layer. This checks what a person actually experiences: that the page itself
 * refuses, and — the part curl cannot see — that a control the actor cannot use
 * is not rendered for them to click.
 */

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const PROTECTED = [
    "/dashboard",
    "/people/employees",
    "/it/vault",
    "/settings/users",
    "/audit",
    "/reports",
  ];

  for (const path of PROTECTED) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      // The `next` parameter is what returns the user to where they were
      // heading; losing it would be a small but real regression.
      expect(page.url()).toContain("next=");
    });
  }

  test("the API refuses too, not just the pages", async ({ request }) => {
    const response = await request.get("/api/audit/export");
    expect(response.status()).toBe(401);
  });
});

test.describe("VIEWER", () => {
  test.use({ storageState: STORAGE_STATE.viewer });

  // A control: VIEWER can reach the pages it is meant to reach, so the denials
  // below cannot be an artefact of a broken session.
  test("reaches the pages it is entitled to", async ({ page }) => {
    await page.goto("/people/employees");
    await expect(page).toHaveURL(/\/people\/employees/);
    await expect(page.getByRole("heading", { name: /employees/i }).first()).toBeVisible();
  });

  for (const path of ["/it/vault", "/settings/users", "/settings/roles"]) {
    test(`is refused ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/no-access/);
    });
  }

  test("is not offered controls it cannot use", async ({ page }) => {
    await page.goto("/people/employees");
    // VIEWER holds no employees.create, so the button must be absent rather
    // than present-and-failing.
    await expect(page.getByRole("link", { name: /add employee|new employee/i })).toHaveCount(
      0,
    );
  });

  test("cannot export the audit log", async ({ request }) => {
    // 404 rather than 403: the route does not admit to existing.
    const response = await request.get("/api/audit/export");
    expect(response.status()).toBe(404);
  });
});

test.describe("HR", () => {
  test.use({ storageState: STORAGE_STATE.hr });

  test("reaches people pages but not the vault", async ({ page }) => {
    await page.goto("/people/employees");
    await expect(page).toHaveURL(/\/people\/employees/);

    await page.goto("/it/vault");
    await expect(page).toHaveURL(/\/no-access/);
  });
});

test.describe("SUPER_ADMIN", () => {
  test.use({ storageState: STORAGE_STATE.superAdmin });

  test("reaches the pages every other role was refused", async ({ page }) => {
    for (const path of ["/it/vault", "/settings/users", "/audit"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    }
  });

  test("can export the audit log", async ({ request }) => {
    const response = await request.get("/api/audit/export");
    // Proves the 404s above are the permission gate, not a missing route.
    expect([200, 429]).toContain(response.status());
  });
});

test.describe("cross-site request forgery", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * Found while building this suite: the auth endpoint refuses a request whose
   * Origin is missing or foreign. That is the control that stops another site
   * from posting a sign-in — or any other auth mutation — using a visitor's
   * cookies, so it is worth a test that would notice if it were relaxed.
   */
  test("the auth endpoint refuses a foreign origin", async ({ request, baseURL }) => {
    const credentials = {
      email: "super-admin@example.local",
      password: "TestUser-Dev-Only-123!",
    };

    const foreign = await request.post("/api/auth/sign-in/email", {
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      data: credentials,
    });
    expect(foreign.status()).toBe(403);

    // The control: the identical request from the real origin succeeds, so the
    // 403 above is the origin check and not bad credentials.
    const own = await request.post("/api/auth/sign-in/email", {
      headers: { "Content-Type": "application/json", Origin: baseURL ?? "" },
      data: credentials,
    });
    expect(own.status()).toBe(200);
  });
});
