/**
 * Test stub for the `server-only` package.
 *
 * The real package throws when imported outside a React Server Component, which
 * is what keeps server modules out of client bundles. Under vitest there is no
 * bundle to protect, so it is replaced with this no-op (see vitest.config.ts).
 */
export {};
