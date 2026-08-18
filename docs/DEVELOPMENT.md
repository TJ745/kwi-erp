# DEVELOPMENT

Setup, conventions, quality gates, and the implementation roadmap. **Proposed — pending approval.**

---

## 1. Prerequisites

| Requirement | Version | Note |
|---|---|---|
| Node.js | **24 LTS** | Detected locally: v25.2.0. That works (Prisma 7 requires `>=24.0`, Next 16 requires `>=20.9`) but 25 is a non-LTS line. Pin 24 via `.nvmrc` for reproducibility. |
| pnpm | 11.9.0 | Detected. Preferred over npm — faster, stricter peer resolution |
| PostgreSQL | Neon | Two connection strings: pooled + direct |
| Git | 2.53.0 | Detected. **Repository is not yet initialised** — `git init` is step 1 |

---

## 2. First-run setup

```bash
git init
pnpm install
cp .env.example .env.local          # then fill in real values

pnpm db:generate                    # prisma generate
pnpm db:migrate                     # prisma migrate dev
pnpm db:seed                        # idempotent seed

pnpm dev                            # http://localhost:3000
```

Generating a vault key (never commit the output):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 3. Scripts

```jsonc
{
  "dev":            "next dev",
  "build":          "prisma generate && next build",
  "start":          "next start",

  "lint":           "eslint .",
  "lint:fix":       "eslint . --fix",
  "typecheck":      "tsc --noEmit",
  "format":         "prettier --write .",

  "db:generate":    "prisma generate",
  "db:migrate":     "prisma migrate dev",
  "db:deploy":      "prisma migrate deploy",
  "db:validate":    "prisma validate",
  "db:studio":      "prisma studio",
  "db:seed":        "tsx prisma/seed.ts",
  "db:reset":       "prisma migrate reset",

  "test":           "vitest run",
  "test:watch":     "vitest",
  "test:e2e":       "playwright test",

  "vault:rotate-kek": "tsx scripts/rotate-kek.ts",
  "expiry:reconcile": "tsx scripts/reconcile-expiry.ts",

  "verify":         "pnpm db:validate && pnpm typecheck && pnpm lint && pnpm test"
}
```

`pnpm verify` is the single gate. It runs before every phase is reported complete and in CI.

---

## 4. Quality gates

Per §47 of the brief, run before any feature is called done:

```bash
pnpm lint
pnpm typecheck        # tsc --noEmit
pnpm db:validate      # prisma validate
pnpm test
```

**Errors get fixed, not silenced.**

- `any` — banned. Use `unknown` + narrowing, or a real type. `@typescript-eslint/no-explicit-any: error`.
- `@ts-ignore` / `@ts-nocheck` / `eslint-disable` — require a same-line comment explaining why, and are surfaced in the phase report. If one appears without justification, the review rejects it.
- `strict: true`, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`.

### ESLint configuration

Flat config, `typescript-eslint@8.66.0` with **type-aware** rules (this is precisely why TypeScript is pinned to 6.0.3 — see ADR-001 in `ARCHITECTURE.md`). Custom rules added for this project:

| Rule | Purpose |
|---|---|
| `no-restricted-imports` — Prisma client outside `server/` | Enforces the layering in ARCHITECTURE §4 |
| `no-restricted-imports` — `server/crypto` outside `server/services/vault` | Keeps vault crypto isolated |
| `no-console` in `src/server/**` | Forces the structured logger, which applies redaction |
| `require-await` / `no-floating-promises` | Catches un-awaited transactions — a real data-corruption class |

---

## 5. Testing strategy

Not test-for-the-sake-of-it. Tests target the logic where a silent bug is expensive:

**Vitest — unit (co-located `*.test.ts`)**
- `lib/expiry.ts` — threshold maths, boundary days, timezone edges
- `server/auth/permissions.ts` — role ∪ override − deny resolution, expiry of temporary grants
- `server/crypto/vault.ts` — encrypt/decrypt round-trip, AAD mismatch rejection, key-version rotation
- `server/audit/redact.ts` — every sensitive field redacted
- Business-rule services — double assignment, offboarding blocking, leave state machine, petty-cash balance

**Playwright — E2E (critical paths only)**
1. Login → dashboard → logout
2. Create employee → upload document with expiry → appears in expiry report
3. Assign asset → attempt second assignment → rejected
4. Vault: unlock → reveal → verify `CredentialAccess` row written
5. Permission denial: `USER` cannot reach `/settings/users` or the vault
6. Leave request → approve → status is correct in both views

Tests run against a disposable database, not the development one.

---

### End-to-end tests

`pnpm test:e2e` runs Playwright against a dev server it starts itself (or reuses
one already running). Browsers install once with `npx playwright install chromium`.

The suite is deliberately small and covers seams, not features:

| Spec | What it proves |
|---|---|
| `access-control` | Unauthenticated redirects, per-role page refusals, that a control the actor cannot use is not rendered, and that the auth endpoint refuses a foreign `Origin` |
| `employee-lifecycle` | An employee can be created and read back through seventeen permission-gated queries, and that a leaving status without a last working date is refused |
| `petty-cash-approval` | The rule the module exists for: a pending entry does not move the balance, a raiser cannot approve their own request, and a second approver clearing it does move it |

Notes for anyone adding to it:

- **One worker, serial.** The specs share a database and some assert on counts.
- **Locators use accessible names**, not label text: required fields render an
  `aria-hidden` asterisk, so `getByLabel("First name", { exact: true })` does not
  match while `getByRole("textbox", { name: "First name" })` does.
- **Never wait on text that also appears as a static label.** An early version
  waited for `/approved/i` after clicking Approve; the page has a heading reading
  "Total in (approved)", so the wait passed instantly and the test navigated away
  mid-action. Wait for a state change — the row leaving the queue.
- **Teardown deletes anything prefixed `E2E`**, reaching past the service layer
  because employees cannot be deleted through the application by design.

### Email notifications

Optional. With no provider configured, notifications stay in-app and every row
is marked `SKIPPED` — a supported state, not a broken one. `/api/health` reports
`emailConfigured` so a deploy that expected to send can tell that it will not.

To switch it on, set `RESEND_API_KEY` and `EMAIL_FROM` (a verified sender on the
provider). Resend is called over its HTTP API rather than through an SDK: one
`fetch`, no dependency to keep in step.

**What gets emailed is decided by data, not code.** A `NotificationRule` for the
kind is authoritative — its `channels` field already existed for this purpose.
Only when no rule exists does the dispatcher fall back to its defaults
(`APPROVAL_REQUIRED`, `TICKET_ASSIGNED`). The seed sets `EXPIRY` rules to
`IN_APP, EMAIL` and leaves task reminders in-app, because one message per task
per day is how people learn to filter the sender. Re-running the seed repairs
rules that predate the channel.

Delivery is recorded on the notification itself — status, attempts, provider
message id, and the last error — so "did they actually get told?" is answerable
per row. Sending happens twice: fire-and-forget when the notification is created
(so an approval does not wait for the nightly run) and again in the cron, which
retries failures up to three attempts and then leaves the row `FAILED` with its
reason.

Verified end to end with a deliberately invalid API key, which exercises
everything except the provider accepting the message:

| Kind | Rule | Outcome |
|---|---|---|
| `EXPIRY` | `IN_APP, EMAIL` | attempted, failure recorded |
| `TASK_DUE` | `IN_APP` | `SKIPPED`, zero attempts |
| `APPROVAL_REQUIRED` | none — default applies | attempted, failure recorded |

Retries stopped after the third attempt, and the stored error contained neither
the API key nor a recipient address. The one hop not exercised is a real
provider accepting a real message; that needs a real key.

## 5a. Deployment runbook

Everything below was verified against a production build on 2026-08-18, not
written from memory. Where a step exists because something surprised us, the
surprise is recorded with it.

### Required environment variables

Seven have no default and no fallback. The app cannot work without them:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled connection. `DIRECT_URL` is optional and used for migrations. |
| `APP_URL` | Absolute, used in links that leave the app. |
| `BETTER_AUTH_SECRET` | At least 32 characters. Rotating it invalidates every session. |
| `BETTER_AUTH_URL` | Must match the deployed origin, or the CSRF origin check refuses sign-in. |
| `VAULT_KEK_V1` | Base64, exactly 32 bytes. **Losing this makes every stored credential unrecoverable** — back it up somewhere that is not the database. |
| `UPLOADTHING_TOKEN` | Server-only. |
| `CRON_SECRET` | Compared in constant time by the nightly endpoint. |

Optional but worth setting deliberately: `UPLOADTHING_TIER` (`free` by default —
see SECURITY.md §6.0 before leaving it there), `ACCEPT_PUBLIC_FILE_STORAGE`,
`VAULT_KEK_V2` (rotation slot), `VAULT_KEK_ACTIVE_VERSION`.

`.env.example` lists every variable. The app refuses to start if the active KEK
version names a key that is not set.

### Deploy

1. **Migrate first, deploy second.** `pnpm prisma migrate deploy` against
   `DIRECT_URL`. Confirm with `npx prisma migrate status`, which must say the
   schema is up to date; anything else means drift and should stop the deploy.
2. **Deploy the build.** `pnpm build` runs `prisma generate` first, so a stale
   client cannot ship.
3. **Hit `/api/health`.** It returns `200 {"status":"ok"}` when configuration
   and database both answer, and `503 {"status":"degraded"}` otherwise.

   This step is not ceremony. Environment validation is **lazy** — on first
   `getEnv()` call, not at import, because eager validation runs during
   `next build` where production secrets are legitimately absent. A production
   server with an invalid `BETTER_AUTH_SECRET` still serves `/login` with HTTP
   200 while being unable to authenticate anyone. Verified deliberately, with an
   invalid value rather than a missing one: `next start` loads `.env` files
   itself, so unsetting a shell variable proves nothing.

   The endpoint is public and says only *that* a check failed. The reason —
   which variable, and why — goes to the server log.
4. **Confirm the cron.** `vercel.json` schedules `/api/cron/expiry-scan` at
   03:00 daily. It answers 401 without the bearer secret. A run returns counts
   for expiry reminders, overdue tasks, and due-today tasks; a scan that never
   runs means reminders silently stop, so check it once after the first night.

### First-run only

`pnpm db:seed` creates roles, permissions, categories, and letter templates. It
**refuses to run with `NODE_ENV=production`** unless `ALLOW_PRODUCTION_SEED=true`
is set explicitly. Seed the reference data, then create the first real
administrator — do not leave a seeded development account on a live system.

### Smoke checks after deploy

Fast, and each one has failed at least once during development:

- `/api/health` returns 200.
- Sign in, then sign out. Sign-in failing with a 403 usually means
  `BETTER_AUTH_URL` does not match the origin — that is the CSRF origin check,
  and it is working.
- Open `/dashboard`: the KPI row and the "needs attention" card both render.
- Open a document from `/documents`. A 404 here means `documents.download` is
  missing, not that the file is.
- Run one report and export it. Exports are rate limited (10/hour, and 5/hour
  for the audit log), so a 429 during testing is the limiter, not a fault.
- If email is meant to be on, confirm `"emailConfigured": true` in the health
  response. It being `false` is silent by design — notifications simply stay
  in-app.

### Rollback

Migrations are forward-only. Roll back the deploy, not the database: a
migration that has run is part of the schema every earlier build must still
tolerate. If a migration must be undone, write a new one that reverses it.

## 6. Conventions

### Files & naming

```
kebab-case.ts           files and folders
PascalCase              components, types, Prisma models
camelCase               functions, variables, fields
SCREAMING_SNAKE_CASE    enum members, constants
```

`employee-form.tsx`, `employee-service.ts`, `employee.schema.ts`. One default-exported component per file; helpers may be co-located while small.

### Service signature

```ts
// every service takes ctx first, and returns projected data
export async function listEmployees(
  ctx: ActorContext,
  query: EmployeeListQuery,
): Promise<Paginated<EmployeeListItem>> { … }
```

### Zod schemas

Live in `lib/schemas/` when shared with the client, `server/services/*/schema.ts` when server-only. Always `.strict()`. One schema per operation — do not reuse a create schema for update.

### Error handling

Services throw typed errors; only the action wrapper converts them:

```ts
class AppError    extends Error { code: ErrorCode }
class NotFoundError extends AppError   // → 404 / "Record not found"
class ForbiddenError extends AppError  // → 403 / "You do not have permission…"
class ConflictError extends AppError   // → 409 / business-rule message
class ValidationError extends AppError // → 422 / fieldErrors
```

Unexpected errors log with a correlation id server-side; the user sees a generic message plus that id. Stack traces, Prisma messages, and schema details never reach the browser.

### Commits

Conventional Commits, scoped by module:

```
feat(employees): add employee profile documents tab
fix(vault): bind AAD to credential id on decrypt
chore(db): add partial unique index for asset assignment
```

Branch per phase: `phase/02-database`, `phase/05-core-data`.

---

## 7. Implementation roadmap

Phases follow the dependency layers in `MODULES.md` §1. Each ends with `pnpm verify` clean and a written report: what was implemented, files changed, database changes, commands run, remaining issues, next phase.

| Phase | Scope | Depends on | Exit criteria |
|---|---|---|---|
| **1 — Analysis** ✅ | Repo inspection, architecture, data model, security design, roadmap | — | These five documents approved |
| **2 — Foundation & DB** ✅ | `git init`, scaffold, tooling, ESLint/TS config, full Prisma schema, migrations, seed | Answers to A–D | `db:validate` + `typecheck` + `lint` clean; seed runs; all ~68 tables migrated |
| **3 — Auth & RBAC** ✅ | Better Auth + Argon2, session, login/logout, guards, permission resolution, user/role admin | 2 | Login works; `requirePermission` enforced; role matrix seeded; permission unit tests pass |
| **4 — App shell** ✅ | Sidebar, header, breadcrumbs, command menu, theme, toasts, and the full shared-component set from MODULES §6 | 3 | `DataTable`, `PageHeader`, `StatusBadge`, `FileUpload`, `EmptyState`… all built and documented; responsive at 3 breakpoints |
| **5 — Core data** ✅ | Companies, departments, positions, **Employees** (all tabs), Documents + file storage, Tasks, Notifications skeleton, Expiry engine | 4 | Employee CRUD complete; document upload/download authorised; expiry projection populating |
| **6 — HR & Admin** ✅ | Contracts, offers, job descriptions, checklist engine (onboarding/offboarding/clearance), leave, timesheet, evaluations, increments, warnings, correspondence, petty cash, accommodation, suppliers, subcontractors, bills, certificates | 5 | Each module CRUD + audit + permissions; offboarding blocks on outstanding assets |
| **7 — IT** ✅ | Helpdesk, assets + handover lifecycle, servers, AD, network, IP phones, CCTV, software | 5 | Asset double-assignment rejected at DB level |
| **7b — Password Vault** ✅ | Separate sub-phase: crypto module, unlock, reveal, grants, history, access log, generator | 7 | Security checklist §11 items for vault all verified |
| **8 — Vehicles** ✅ | Vehicles, registration/insurance expiry, maintenance, driver assignment, handover forms | 5 | Fleet alerts appear on dashboard |
| **9 — Medical insurance** ✅ | Policies, providers, expiry, documents; `EmployeeInsurance` table present, UI deferred | 5 | Policy status dashboard accurate |
| **10 — Automation** ✅ | Reminder engine, notification rules, dedupe, cron endpoint, overdue detection, dashboard alert wiring, expiry reconciliation job | 5–9 | Scheduled run produces correct, non-duplicated notifications |
| **11 — Documents & letters** ✅ | Template engine, variable resolution, preview, generation, print view, `dataSnapshot`. Server-side PDF deferred (see §7) | 5, 6 | Letters generate correctly for all seeded templates |
| **12 — Reports** ✅ | 12 report families, filters, CSV/Excel export, print views, one shared column derivation | 5–11 | Every report present with filters + export; gated columns absent from both screen and file |
| **13 — Security review** | Full checklist in `SECURITY.md` §11, `pnpm audit`, dependency review, penetration-style self-test | all | All 20 items verified in code and, where observable, live. Three findings fixed: non-strict update schemas, unlimited change-password attempts, one high + one moderate advisory |

### Sequencing notes

- **Phase 7b is separated deliberately.** The vault is not "one more IT screen" — it gets its own implementation pass, its own review, and its own tests. Bundling it into Phase 7 is how vault bugs ship.
- **Dashboard is not a phase.** It is assembled incrementally: each phase adds its own KPI cards and alert feed. Building it once at the end would mean rebuilding it after every module.
- **Reports come last** because they read every domain table; building them earlier guarantees rework.
- **Phase 2 is blocked** on Decisions A–D — file storage, cron mechanism, company scoping, and Arabic support all touch the schema or the very first configuration.

---

## 8. Definition of done (per module)

A module is complete only when **all** of these hold:

- [ ] Server-side authorisation on every action and route
- [ ] Zod validation, `.strict()`, on every input
- [ ] Company/ownership scoping applied inside queries
- [ ] List (server-driven table), detail, create, edit, delete/status flows
- [ ] Loading, empty, error, and success states — using the shared components
- [ ] Audit entries on every mutation, with redaction
- [ ] Responsive at mobile / tablet / desktop, tables transforming rather than shrinking
- [ ] Keyboard accessible, labelled form controls, focus management in dialogs
- [ ] No `any`, no unexplained suppressions
- [ ] `pnpm verify` clean
- [ ] No mock data remaining once the real feature exists
- [ ] No TODO placeholders in core paths

---

## 9. Reporting format after each phase

Per §56 of the brief, each phase closes with:

1. **Implemented** — what actually works, described honestly
2. **Files** — created and changed
3. **Database** — models added, migrations run, indexes/constraints introduced
4. **Commands** — exactly what was executed and its result
5. **Remaining issues** — known gaps, deferred items, anything partial (stated as partial)
6. **Next phase** — recommendation and any new questions

Nothing is reported complete that is not actually implemented and verified.

---

## 9a. Module completion (2026-08-13)

Every module in the brief now has a working screen, and `planned: true` no
longer appears in `lib/navigation.ts`. The modules below were built after the
13-phase roadmap, in nine commits, against tables and permissions that had
shipped in Phase 2 and been waiting since:

| Group | Modules |
|---|---|
| Admin & Ops | Suppliers, Subcontractors + contracts, Company Certificates, Electricity Bills, Petty Cash, Accommodation |
| HR | Warnings, Correspondence, Increments, Evaluations, Job Offers, Job Descriptions, Timesheet |
| IT | Servers, Network + IP register, IP Phones, CCTV, Software Licences, Active Directory |
| Platform | Audit Log, Documents hub, Document Types, Checklist Templates, Org Chart, Vehicle Handovers, Global Search |

Two defects in existing code were found by building on top of it:

- `SOFTWARE_LICENSE` was an `ExpirySource` with no collector in
  `reconcileExpiryIndex`, which deactivates any active row it does not collect.
  Licence expiries would have been switched off on the first nightly run.
- The increments table gated its salary columns in the page rather than the
  service, leaving the figures in the RSC payload — the same shape as the
  Phase 11 letters leak.

---

## 10. Deferred items (tracked, not forgotten)

Recorded here so they are decisions rather than omissions:

| Item | Rationale | Revisit |
|---|---|---|
| TypeScript 7 | `typescript-eslint` peer range excludes it (ADR-001) | When typescript-eslint ships support |
| ESLint 10 | `eslint-plugin-react` (via `eslint-config-next`) crashes on it (ADR-009) | When eslint-plugin-react supports ESLint 10 |
| Full Arabic UI / RTL | Decision D: Arabic data + bilingual letters only; UI stays English | Only as a scoped follow-up project, not a toggle |
| Antivirus scanning of uploads | `FileObject.scanStatus` exists so a scanner can be inserted with no schema change | If policy requires it |
| MFA / TOTP | Not in v1 scope; schema leaves room | Immediately post-launch for `SUPER_ADMIN` + vault holders |
| SSO / directory sync | No requirement stated | If the company adopts Microsoft Entra |
| Full-text search (`tsvector`) | Trigram covers actual usage | If search latency degrades past ~50k employees |
| Leave accrual engine | Brief specifies request/approval only | On request |
| Audit log partitioning | Only needed at high volume | When `AuditLog` passes ~10M rows |
| Server-side PDF (`puppeteer-core` + `@sparticuz/chromium`) | ADR-004 makes browser print the primary path — it renders Arabic perfectly and costs nothing. Chromium is only needed to *store* a PDF file. **No longer blocked** now that uploads work (2026-08-12) | On request — it is now buildable |
| Vault export (`vault.export`) | Deliberately not built. An export of the vault is a plaintext copy of every credential in one file; if it is ever needed it should be a re-authenticated, single-use, audited flow rather than a button | Only with a stated requirement |
| `employees.export` | The report layer gates on `reports.export`; this key never had a distinct meaning. Candidate for removal from the catalogue rather than for wiring | Housekeeping |
| `it.view` | Superseded by the granular `it.tickets.*` / `it.assets.*` / `it.infrastructure.*` keys. Candidate for removal | Housekeeping |
| `employees.delete` | Correctly unused: MODULES.md §7 forbids hard-deleting an employee, and the service rejects it. The key exists so a role editor can show it as never granted | Leave as is |
| Company logo (`Company.logoFileId`) | The column exists and nothing renders a logo. Two things block it, neither worth working around for a cosmetic feature: (1) every file byte is served by `/api/files/[id]`, which requires `documents.download` — so a logo in the sidebar would 404 for most users, and a second file-serving route is new security surface; (2) the letter sanitiser excludes `<img>` by design ("nothing that can load, execute, or navigate"), so a letterhead logo would mean weakening a deliberate control. **Product-owner decision** |
| WYSIWYG template editor | Templates are authored as HTML in a textarea, with live placeholder validation. A rich-text editor would need its own output sanitised against the same allowlist | If non-technical staff author templates directly |
| Letters for non-employee entities | `GeneratedLetter.entityType` and `entityId` are generic; only `EMPLOYEE` is wired | When vehicle/asset handover forms are built |
| Charted reports (Recharts) | `recharts` is installed and used on the dashboard. Report families are tabular by design: they exist to be filtered, printed, and exported, and a chart is not exportable to CSV | If a specific report is asked for as a chart |
| Scheduled / emailed reports | The email channel now exists, so this is buildable: a cron that runs a report and attaches the CSV. Not built — nobody has asked for a specific schedule | On request |
