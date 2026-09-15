import type { NextConfig } from "next";

/**
 * Security headers — see docs/SECURITY.md §8.
 * CSP is intentionally strict; `unsafe-inline` for styles is required by
 * Tailwind's runtime style injection and is the one concession made.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" +
        (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      // Deliberately NOT allowing the storage host. Every stored file is read
      // through /api/files/[id], which authorises then streams the bytes, so
      // nothing legitimately renders a storage URL. On the free tier those
      // objects are world-readable, which makes the URL the only secret —
      // this stops a future <img src="https://…ufs.sh/f/…"> from disclosing
      // one, at the browser rather than on trust.
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.ufs.sh https://*.uploadthing.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Native modules that must never be bundled: argon2 bindings, the Prisma
  // engine, and the Chromium binary used for Arabic-capable PDF generation.
  serverExternalPackages: [
    "@node-rs/argon2",
    "@prisma/client",
    "@sparticuz/chromium",
    "puppeteer-core",
  ],

  // Next 16 prints every Server Function call to the dev terminal WITH its
  // arguments — which for loginAction is the password, and for the vault and
  // user-creation actions is a credential. Development only, but a terminal
  // scrollback is still a log (SECURITY.md: never expose passwords in server
  // logs), so it is off. Our own logger never receives action input.
  logging: {
    serverFunctions: false,
  },

  // Next 16 removed the `eslint` config key; linting is its own gate (pnpm lint).
  typescript: {
    // Never ignore type errors — pnpm typecheck must pass.
    ignoreBuildErrors: false,
  },

  // Next's type requires a Promise here; there is nothing to await, so resolve
  // directly rather than marking the function `async`.
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: securityHeaders }]);
  },
};

export default nextConfig;
