/**
 * The seeded development accounts the e2e suite signs in as.
 *
 * These are the fake credentials created by `scripts/make-test-user.ts`; the
 * seed refuses to run against a production database and these passwords exist
 * nowhere but a development machine.
 */
export const E2E_PASSWORD = "TestUser-Dev-Only-123!";

export const ROLES = {
  superAdmin: "super-admin@example.local",
  hr: "hr@example.local",
  itAdmin: "it-admin@example.local",
  viewer: "viewer@example.local",
  // A second privileged account: the services refuse self-approval, so any
  // approval journey needs someone other than the person who raised it.
  approver: "approver@example.local",
} as const;

export type RoleName = keyof typeof ROLES;

export const STORAGE_STATE: Record<RoleName, string> = {
  superAdmin: "tests/e2e/.auth/super-admin.json",
  hr: "tests/e2e/.auth/hr.json",
  itAdmin: "tests/e2e/.auth/it-admin.json",
  viewer: "tests/e2e/.auth/viewer.json",
  approver: "tests/e2e/.auth/approver.json",
};

/**
 * Marks every record the suite creates so teardown can find them, and so a
 * stray fixture in a shared development database is obviously a test artefact
 * rather than someone's real data.
 */
export const E2E_PREFIX = "E2E";

export function e2eName(label: string): string {
  return `${E2E_PREFIX} ${label} ${Date.now().toString().slice(-6)}`;
}
