import { expect, test } from "@playwright/test";
import { e2eName, STORAGE_STATE } from "./roles";

/**
 * The approval journey, end to end and across two people.
 *
 * This is the seam the unit tests cannot reach. It asserts the rule the module
 * exists to enforce: **a pending entry does not move the balance**. Everything
 * else here — the request appearing on someone else's screen, self-approval
 * being refused — is the machinery that makes that rule usable.
 */
test.describe.configure({ mode: "serial" });

test.describe("petty cash approval", () => {
  const accountName = e2eName("Float");
  let accountUrl = "";

  test("a controller opens an account", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.superAdmin });
    const page = await context.newPage();

    await page.goto("/admin/petty-cash");
    await page.getByRole("button", { name: /open account/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Account name", exact: true }).fill(accountName);
    await dialog.getByRole("textbox", { name: /opening balance/i }).fill("1000");
    await dialog.getByRole("button", { name: /open account/i }).click();

    // The opening balance is what every later assertion is measured against.
    await expect(page.getByText(accountName).first()).toBeVisible();

    await page.getByText(accountName).first().click();
    await page.waitForURL(/\/admin\/petty-cash\/[a-z0-9]+$/i);
    accountUrl = new URL(page.url()).pathname;

    await expect(page.getByText("1,000.00").first()).toBeVisible();

    await context.close();
  });

  test("a pending expense does not move the balance", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.superAdmin });
    const page = await context.newPage();

    await page.goto(accountUrl);
    await page.getByRole("button", { name: /record transaction/i }).click();

    const dialog = page.getByRole("dialog");

    // Category is required. Picking the first seeded option rather than naming
    // one keeps this from breaking when the seed's categories change.
    await dialog.getByRole("combobox", { name: "Category", exact: true }).click();
    await page.getByRole("option").first().click();

    await dialog.getByRole("textbox", { name: /^amount/i }).fill("250");
    await dialog
      .getByRole("textbox", { name: "Description", exact: true })
      .fill(`${accountName} coffee run`);
    await dialog.getByRole("button", { name: /raise transaction/i }).click();

    await expect(page.getByText(`${accountName} coffee run`).first()).toBeVisible();

    // The rule: the money has not moved, because nobody has approved it.
    await expect(page.getByText("1,000.00").first()).toBeVisible();
    // But it is visible as committed-if-approved.
    await expect(page.getByText("250.00").first()).toBeVisible();

    await context.close();
  });

  test("the raiser cannot approve their own request", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.superAdmin });
    const page = await context.newPage();

    await page.goto("/admin/petty-cash");
    const row = page.locator("tr", { hasText: `${accountName} coffee run` });
    await expect(row).toBeVisible();

    await expect(row.getByText(/your own request/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /^approve$/i })).toHaveCount(0);

    await context.close();
  });

  test("a second approver clears it, and the balance moves", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.approver });
    const page = await context.newPage();

    await page.goto("/admin/petty-cash");

    const row = page.locator("tr", { hasText: `${accountName} coffee run` });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /^approve$/i }).click();

    // Waiting for the row to leave the pending queue, NOT for the word
    // "approved" to appear: the page has static labels reading "Total in
    // (approved)", so matching that text passed instantly and the test
    // navigated away while the action was still in flight — which is why the
    // balance had not moved.
    await expect(row).toHaveCount(0, { timeout: 20_000 });

    await page.goto(accountUrl);
    // 1000 − 250. The balance is derived from the ledger, never stored, so this
    // is the derivation running over a real approved row.
    await expect(page.getByText("750.00").first()).toBeVisible();

    await context.close();
  });
});
