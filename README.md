# KWI / ICC Operations Management System

Internal operations system for a two-company group: HR, documents, fleet, IT
inventory, administration, a password vault, letters and reports. Next.js 16
App Router, Prisma 7 on Neon Postgres, Better Auth, UploadThing.

The detailed documents live in `docs/` — start with `docs/ARCHITECTURE.md`,
then `docs/SECURITY.md` and `docs/DEVELOPMENT.md`. This file is only the path
from a fresh clone to a running system.

## Run it locally

```bash
pnpm install
cp .env.example .env.local        # then fill it in — see below
pnpm db:migrate                   # applies migrations to DATABASE_URL
pnpm db:seed                      # reference data + the super admin
pnpm dev                          # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env.local`.

**Use `pnpm dev` for anything involving file uploads.** UploadThing completes
an upload by calling back into the app, and it cannot reach `localhost` under
`next start` — the file lands in storage but is never registered. Explained,
with measurements, in `docs/DEVELOPMENT.md`.

## What the seed creates

Reference data only, and one account:

- every permission (they are defined in code — `src/lib/permissions.ts`)
- the six built-in roles and their grants
- two companies (KWI, ICC) with placeholder details you replace in Settings
- default departments, positions, leave types, document types
- checklist templates, notification rules, and the letter templates
- **one super administrator**, from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`

No employees, no sample records. It is safe to re-run: company and department
details you have entered are never overwritten.

## Environment

Every variable is validated at boot (`src/lib/env.ts`) and placeholders are
rejected, so a mis-set deployment fails to start rather than half-working.
`.env.example` documents each one. Generate the three secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection (host contains `-pooler`) |
| `DIRECT_URL` | Same host **without** `-pooler`; migrations need it |
| `APP_URL`, `BETTER_AUTH_URL` | The public URL of the deployment |
| `BETTER_AUTH_SECRET` | 32 random bytes, base64 |
| `VAULT_KEK_V1` | 32 random bytes, base64. **Losing it makes every vault credential unrecoverable.** Back it up offline. |
| `UPLOADTHING_TOKEN` | From the UploadThing dashboard |
| `UPLOADTHING_TIER` | `free` (current) or `pro` |
| `ACCEPT_PUBLIC_FILE_STORAGE` | Must be `true` to run the free tier in production — see `docs/SECURITY.md` §6 |
| `CRON_SECRET` | ≥ 16 random characters; Vercel Cron sends it |
| `SEED_ADMIN_*` | Only read by the seed |

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. In **Settings → Environment Variables**, add everything in the table above
   for the Production environment. `APP_URL` and `BETTER_AUTH_URL` are your
   Vercel domain, e.g. `https://oms.yourcompany.com`.
3. Deploy. The build runs `prisma generate && prisma migrate deploy && next
   build`, so **migrations are applied automatically on every deploy**.
4. **Seed once.** Vercel does not run the seed. From your machine, against the
   production database:

   ```bash
   DATABASE_URL="<production pooled url>" \
   DIRECT_URL="<production direct url>" \
   NODE_ENV=production ALLOW_PRODUCTION_SEED=true \
   SEED_ADMIN_EMAIL="you@company.com" SEED_ADMIN_PASSWORD="<strong password>" \
   pnpm db:seed
   ```

   On Windows PowerShell, set each with `$env:NAME="value"` first, then run
   `pnpm db:seed`. Do **not** add `ALLOW_PRODUCTION_SEED` to Vercel itself.
5. Sign in, go to **Settings → Companies**, and replace the placeholder company
   details with the real ones. Upload letterhead there too.

`vercel.json` already schedules the nightly expiry scan (`/api/cron/expiry-scan`
at 03:00 UTC); it authenticates with `CRON_SECRET`.

## Quality gates

```bash
pnpm verify        # prisma validate + typecheck + lint + unit tests
pnpm test:e2e      # Playwright, against a running dev server
```
