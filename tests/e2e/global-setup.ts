import { E2E_PASSWORD, ROLES } from "./roles";

/**
 * Warms the routes the suite touches.
 *
 * `next dev` compiles a route on its first request, which can take tens of
 * seconds. Without this the first spec to reach any page is racing the
 * compiler rather than testing the application, and fails with a timeout that
 * looks like a broken feature. Warming here makes that cost visible and paid
 * once, instead of appearing as a flaky test later.
 *
 * A production build compiles ahead of time, so this is a no-op cost there.
 */
const ROUTES = [
  "/dashboard",
  "/people/employees",
  "/people/employees/new",
  "/it/vault",
  "/it/assets",
  "/settings/users",
  "/audit",
  "/reports",
  "/no-access",
];

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

  const signIn = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Better Auth rejects a request with no Origin (MISSING_OR_NULL_ORIGIN),
      // which is the CSRF protection doing its job. A browser always sends
      // one; Node's fetch does not, so it is set explicitly here.
      Origin: baseURL,
    },
    body: JSON.stringify({ email: ROLES.superAdmin, password: E2E_PASSWORD }),
  });

  if (!signIn.ok) {
    // Not fatal: the specs will report the real problem far more clearly than
    // a warm-up failure would.
    console.warn(`e2e warm-up: could not sign in (${String(signIn.status)}); skipping.`);
    return;
  }

  const cookie = signIn.headers.getSetCookie().join("; ");
  const startedAt = Date.now();

  // Sequential on purpose: the dev server compiles one route at a time anyway,
  // and hammering it in parallel only makes the first request slower.
  for (const route of ROUTES) {
    try {
      await fetch(`${baseURL}${route}`, { headers: { cookie } });
    } catch {
      // A route that fails to warm will fail loudly in its own spec.
    }
  }

  console.log(
    `e2e warm-up: compiled ${String(ROUTES.length)} routes in ${String(
      Math.round((Date.now() - startedAt) / 1000),
    )}s`,
  );
}
