# ARCHITECTURE

Operations Management System (OMS) — internal business application for KWI / ICC.

Status: **Proposed — awaiting product owner approval.** No application code has been written yet.

---

## 1. Repository baseline (Phase 1 findings)

The target directory `18-kwi-admin-erp/` was **empty**. There is:

- no existing `package.json`, source tree, or configuration
- no existing Prisma schema or database
- no existing auth implementation or components
- no git repository initialised

**Consequence:** there is nothing to reuse and nothing to conflict with. This is a clean greenfield build, so the architecture below is unconstrained by legacy decisions. `git init` should be the first action of Phase 2.

### Local toolchain (verified)

| Tool | Detected | Note |
|---|---|---|
| Node | v25.2.0 | Works, but **odd-numbered = non-LTS**. Pin Node 24 LTS via `.nvmrc`. |
| npm | 11.6.2 | Available |
| pnpm | 11.9.0 | Available — **recommended** (faster, stricter dep resolution) |
| git | 2.53.0 | Available, repo not initialised |

---

## 2. Stack — resolved versions and rationale

All versions below were resolved against the live npm registry, not assumed.

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Framework | Next.js (App Router) | `16.3.0` | Required. Engines `node >=20.9.0`. |
| UI runtime | React | `19.2.8` | Server Components, `useActionState`, `useOptimistic`. |
| Language | TypeScript | **`6.0.3`** | See ADR-001 — *not* the `latest` tag (7.0.2). |
| Linting | ESLint | **`9.39.5`** | See ADR-009 — *not* the `latest` tag (10.8.1). |
| Styling | Tailwind CSS | `4.3.3` | CSS-first config, no `tailwind.config.js` needed. |
| Components | shadcn/ui CLI | `4.16.2` | Copy-in components, owned in-repo. |
| ORM | Prisma | `7.9.1` | Engines `^20.19 \|\| ^22.12 \|\| >=24.0`. |
| Database | PostgreSQL (Neon) | — | Serverless driver + connection pooling. |
| Auth | Better Auth | `1.6.26` | Peer-supports `next ^16`, `prisma ^7`, `react ^19`. |
| Validation | Zod | `4.4.3` | Already a transitive dep of Better Auth — no version conflict. |
| Forms | React Hook Form | `7.85.0` | Complex multi-section forms only. |
| Hashing | `@node-rs/argon2` | `2.0.2` | Argon2id, native bindings. See ADR-002. |
| Dates | date-fns | `4.4.0` | Tree-shakeable, no global mutation. |
| Charts | Recharts | `3.10.1` | Dashboard + reports. |
| Tables | `@tanstack/react-table` | `9.1.2` | Headless; wrapped by our own `DataTable`. |
| Icons | lucide-react | `1.31.0` | Required. |
| Excel | `exceljs` | `4.4.0` | See ADR-003. |
| PDF | `puppeteer-core` + `@sparticuz/chromium` | `25.5.0` / `149.0.0` | Arabic-capable — see ADR-004. |
| File storage | `uploadthing` + `@uploadthing/react` | `7.7.4` / `7.3.3` | ACL by tier, signed URLs, proxied downloads — see ADR-008. |
| Tests | Vitest + Playwright | `4.1.10` / `1.62.1` | Domain unit tests + critical-path E2E. |

### Deliberately *not* added

- **`@aws-sdk/client-s3`** — superseded by UploadThing (ADR-008). Dropping it removes a heavy dependency.
- **`@react-pdf/renderer`** — dropped once Arabic letters were confirmed required (ADR-004).
- **`next-safe-action`** — our own `defineAction()` wrapper (§6) is ~80 lines and gives us the auth → authz → validate → audit pipeline the generic library does not. One less dependency to track.
- **`nuqs`** — native `searchParams` plus one shared `parseListQuery()` helper covers table state.
- **`xlsx` / SheetJS** — see ADR-003.
- **State management library** — server-first design means there is almost no client state to manage.

---

## 3. Architecture Decision Records

### ADR-001 — Pin TypeScript to 6.0.3, not 7.0.2

The `latest` tag on npm is TypeScript `7.0.2`. However `typescript-eslint@8.66.0` declares:

```
peerDependencies: { typescript: ">=4.8.4 <6.1.0" }
```

Adopting TS 7 today means type-aware ESLint rules cannot run, so `npm run lint` becomes near-worthless — directly violating the code-quality gate in §47 of the brief. TypeScript `6.0.3` is the newest **stable** release inside the supported range and satisfies Prisma's `typescript >=5.4.0` peer requirement.

**Decision:** pin `typescript@6.0.3`. Revisit once `typescript-eslint` ships TS 7 support; the upgrade is expected to be a version bump only.

**Confirmed in Phase 2.** With TS 6.0.3, type-aware linting runs and `tsc --noEmit` is clean.

### ADR-009 — Pin ESLint to 9.39.5, not 10.8.1

Found while wiring the lint gate in Phase 2. ESLint `10.8.1` is `latest`, but `eslint-config-next@16.3.0` pulls `eslint-plugin-react@7.37.5`, whose peer range ends at `^9.7`. On ESLint 10 it throws at rule-load time:

```
TypeError: Error while loading rule 'react/display-name':
contextOrFilename.getFilename is not a function
```

`context.getFilename()` was removed in ESLint 10 and no published `eslint-plugin-react` has migrated. Linting is impossible on ESLint 10 with the Next config, so this is not a stylistic preference.

`eslint@9.39.5` satisfies every peer in the graph — `eslint-config-next` (`>=9.0.0`), `typescript-eslint@8.66.0` (`^9.0.0`), and `eslint-plugin-react` (`^9.7`).

**Decision:** pin `eslint@9.39.5`. Revisit when `eslint-plugin-react` supports ESLint 10.

### ADR-010 — Expiry arithmetic runs in a fixed business timezone

Found by a failing test in Phase 2. `date-fns` `startOfDay` uses the **server's** local timezone. Vercel functions run in UTC, developer machines run in local time, and the business operates in Riyadh (UTC+3) — so "days until expiry" would differ by host. Concretely: an Iqama expiring at 01:00 Riyadh reads as *the previous day* on a UTC server, silently shifting every reminder, dashboard bucket, and expiry report by one day.

`src/lib/expiry.ts` therefore does all day arithmetic against `BUSINESS_TIMEZONE = "Asia/Riyadh"` using a fixed offset (Riyadh observes no DST, so this is exact). The test suite is asserted to pass under UTC, America/New_York, Asia/Tokyo, and Pacific/Kiritimati.

`expiryCutoff()` returns the **last instant** of the target day rather than its start — an exclusive bound would silently drop every record expiring on day N.

### ADR-002 — Argon2id via Better Auth's custom hasher

Better Auth defaults to scrypt. The brief mandates Argon2. Better Auth exposes a hook:

```ts
emailAndPassword: {
  password: {
    hash:   (password) => argon2.hash(password, ARGON2_PARAMS),
    verify: ({ password, hash }) => argon2.verify(hash, password),
  },
}
```

`@node-rs/argon2` is a native module — it will not run on edge runtime, so all auth routes are pinned to the Node.js runtime. Parameters are documented in `SECURITY.md`.

### ADR-003 — `exceljs` over SheetJS

SheetJS (`xlsx`) left the public npm registry and its last public versions carry prototype-pollution advisories. `exceljs` writes genuine `.xlsx`, is actively maintained on npm, and supports the streaming writer we need for large report exports.

### ADR-004 — Letters render as HTML first, PDF via headless Chromium second

**Resolved by Decision D: bilingual Arabic/English letters are required.**

Generated letters (offers, warnings, clearance, handover forms) are authored as **HTML templates with a print stylesheet**. Browser "Print → Save as PDF" produces perfect output for free, including correct Arabic shaping and bidirectional text. This is the primary path and covers most day-to-day use.

Server-side PDF — needed wherever a letter must be *stored* as a file rather than printed — uses **`puppeteer-core@25.5.0` + `@sparticuz/chromium@149.0.0`**, a real Chromium binary running inside our own Vercel function.

`@react-pdf/renderer` is **rejected**: its Arabic glyph-shaping and bidi support are weak, and an official Saudi employment letter with broken Arabic ligatures is worse than no letter at all.

Implementation constraints, stated up front because they bite late:

- The renderer runs on the Node.js runtime with `maxDuration` raised; it cannot run on edge.
- `@sparticuz/chromium` is large. It must be an external package (`serverExternalPackages`) and kept out of the client bundle; Vercel's unzipped function-size limit is the real ceiling to watch.
- Arabic fonts (Noto Naskh Arabic) are **embedded in the repo and loaded from disk**, not fetched from Google Fonts at render time — a network dependency inside PDF generation is a reliability and privacy problem.
- PDF generation is a queued, audited operation, never a synchronous blocking call in a form submit.

**Repeating letterhead on every page** (added 2026-08-20). A multi-page letter
must carry the company header and footer on *each* page, inside 1in margins.
That combination needs two mechanisms, and neither alone is sufficient:

| Mechanism | Gives | Cannot give |
|---|---|---|
| `<thead>` / `<tfoot>` in a wrapping `<table class="letter-frame">` | Repeats on every printed page **and reserves its height there**, so body text never runs under the letterhead | Pins the footer to the bottom of a **short final page** — `tfoot` sits directly under the last paragraph instead |
| `position: fixed` | Repeats on every page pinned to the page box, including the last | Reserves no space at all — padding on a flowing block applies only to its first and last fragment, so pages 2..n would overlap |

So the header uses `thead` (top of the page is where it lands anyway), and the
footer uses **both**: `tfoot` reserves a fixed 1.7in band on every page, and
`.letter-foot` is `position: fixed; bottom: 0` to paint it. The band is a fixed
height because CSS cannot ask how tall the rendered footer is; 1.7in covers the
35mm artwork cap plus its gap.

The table is layout-only and carries none of a table's appearance. Its
`display: table-header-group` / `table-footer-group` values are restated in the
print block even though they are the defaults — the whole feature silently
collapses to "letterhead on page one" if anything overrides them.

Verified against a real 11-page PDF: all 11 pages carried both images, ink
measured 1.00–1.01in from every edge, and the footer sat 1.01in from the bottom
on the short final page as well as the full ones.

`@page { margin: 1in }` is global, so reports print with the same margins.
Reports get **no letterhead**: they have no company context — a report can span
every company the reader can see, so there is no single letterhead that would
not be a lie.

### ADR-008 — UploadThing for file storage, with two mandatory hardening steps

**Resolved by Decision B: UploadThing.**

`uploadthing@7.7.4` + `@uploadthing/react@7.3.3`. It gives us presigned direct-to-storage uploads, a typed file-router with a `middleware` auth hook, per-route `maxFileSize` and type constraints, and React upload components — replacing a meaningful amount of S3 plumbing.

Two things about it directly conflict with `SECURITY.md` unless handled explicitly. Both are commitments, not caveats:

**1. Files must be private by default.** UploadThing defaults to `public-read`, which would make every passport scan readable by anyone holding the URL — exactly threat T5. We therefore set `acl: "private"` on every file route, enable the private-ACL permission in the UploadThing dashboard, and set the app-level default ACL to private. Access flows through `generateSignedURL()` (local signing, no API round-trip, added in v7.5) with a **60-second** expiry, issued only after our own authorisation check in `/api/files/[id]`. Signed URLs are never embedded in server-rendered HTML.

*A startup assertion verifies the configured default ACL is private and refuses to boot otherwise* — this is too important to leave to a dashboard toggle someone might flip.

**2. Magic-byte validation moves after the upload.** Because the browser uploads directly to UploadThing, we cannot sniff file headers before the bytes are stored. The `onUploadComplete` handler therefore fetches the first bytes via a signed URL, verifies the magic number against the declared type, and on mismatch **deletes the file and refuses to create the `FileObject` row**. The file is only visible to the application once validation passes — `FileObject.scanStatus` gates it.

> ### Resolved 2026-08-12 — free tier accepted, `UPLOADTHING_TIER` is the switch
>
> Verified against the configured app (`pnpm tsx scripts/verify-storage.ts`):
>
> | Attempt | Result |
> |---|---|
> | Upload with `acl: "private"` | **HTTP 400** — *"Private files are not allowed for free apps. Upgrade your app to a paid tier to enable private files."* |
> | Upload with the default ACL | Accepted — and the **unsigned URL returns HTTP 200**, i.e. world-readable |
> | `generateSignedURL` on a public object | Works — so reads still use an expiring URL |
>
> **The product owner chose (c), the free tier, with an upgrade to follow.**
> Commitment 1 above therefore now reads: *files are private when the tier
> allows it*. On the free tier the route ACL is omitted — declaring one makes
> every upload fail — and the object is world-readable to anyone with the URL.
>
> The mitigation is that the URL is never disclosed. Downloads **stream through
> `/api/files/[id]`** rather than redirecting, so the storage URL never reaches
> the browser; no storage URL is persisted or rendered; and CSP `img-src` no
> longer allows the storage host, so a future attempt to reference one fails in
> the browser rather than on trust. Residual risk and its limits are stated in
> `SECURITY.md` §6.0.
>
> Upgrading is `UPLOADTHING_TIER=pro` and nothing else: the route config regains
> `acl: "private"` and `readUrlFor` returns signed URLs only. The boot assertion
> now enforces the tier in **both** directions — a private ACL on the free tier
> would break every upload, a missing one on the pro tier would publish identity
> documents.

**Data residency — decided 2026-08-18:** the product owner accepts UploadThing and non-KSA storage. The original flag, kept for the reasoning behind it: UploadThing stores files on third-party infrastructure outside Saudi Arabia. Iqama and passport scans are personal data under the Saudi PDPL, which restricts cross-border transfer. This is a business/legal decision, not a technical one — flagging it now rather than after go-live. If it becomes a problem, the storage adapter is deliberately kept behind a `StorageProvider` interface so swapping to a regional S3 bucket is a contained change.

### ADR-005 — One `ExpiryIndex` projection instead of ten expiry queries

Eleven different record types carry expiry dates (Iqama, passport, contract, document, company certificate, vehicle registration, vehicle insurance, subcontractor contract, medical insurance, IT warranty, supplier contract). Naively, the dashboard, notification engine, and expiry reports each need an 11-way `UNION`.

Instead, every expiry-bearing mutation writes a row into a single `ExpiryIndex` projection **inside the same transaction**, plus a nightly reconciliation job that rebuilds from source tables to self-heal drift. The reminder engine, dashboard alert cards, and expiry reports then become one indexed query.

Detail and trade-offs in `DATABASE.md` §6.

### ADR-006 — Generic checklist engine for onboarding / offboarding / clearance

The brief lists `Onboarding`, `OnboardingTask`, `Offboarding`, `OffboardingTask`, clearance forms, and return confirmation as separate entities — six-plus tables with near-identical shape (ordered steps, status, assignee, due date, attachment, notes).

These collapse into **four** tables: `ChecklistTemplate`, `ChecklistTemplateItem`, `ChecklistInstance`, `ChecklistItem`, discriminated by a `ChecklistType` enum. Benefits: templates become configurable by Admin without a migration, one UI component serves all three workflows, and "what is outstanding for this leaver?" is a single query.

### ADR-007 — Expiry/overdue status is computed, never stored

`VALID | EXPIRING_SOON | EXPIRED` and task `overdue` are pure functions of a date and today. Storing them guarantees staleness the moment the clock rolls past midnight. They are derived in SQL (for filtering/sorting) and in TypeScript (for display) from one shared threshold config.

---

## 4. Layering

```
┌─────────────────────────────────────────────────────────┐
│  app/            Routing, Server Components, layouts     │  ← no business logic
├─────────────────────────────────────────────────────────┤
│  components/     Presentational + shared UI primitives   │  ← no data access
├─────────────────────────────────────────────────────────┤
│  server/actions/ Server Actions — thin pipeline only     │
│  app/api/        Route Handlers — files, cron, webhooks  │
├─────────────────────────────────────────────────────────┤
│  server/services/  Domain logic, transactions, rules     │  ← the real system
├─────────────────────────────────────────────────────────┤
│  server/auth/    Session, permission resolution          │
│  server/db/      Prisma client + extensions              │
│  server/audit/   Audit writer + redaction                │
│  server/storage/ Object storage adapter                  │
│  server/crypto/  Vault envelope encryption               │
├─────────────────────────────────────────────────────────┤
│  lib/            Pure helpers, shared Zod schemas, enums │  ← isomorphic, no I/O
└─────────────────────────────────────────────────────────┘
```

**Hard rules**

1. A React component never imports Prisma directly. It calls a service (Server Component) or an action (Client Component).
2. A service never reads the session. It receives an explicit `ctx: ActorContext` (`userId`, `companyScope`, `permissions`). This keeps services unit-testable and makes authorisation impossible to forget silently.
3. `lib/` must be importable from both client and server — no `server-only` imports there.
4. Anything touching secrets imports `server-only` to make client leakage a build error.

## 5. Directory structure

```
src/
├── app/
│   ├── (auth)/login, /forgot-password
│   ├── (app)/                       # authenticated shell: sidebar + header
│   │   ├── dashboard/
│   │   ├── people/{employees,onboarding,offboarding,leave,timesheet,org-chart}/
│   │   ├── hr/{letters,contracts,offers,evaluations,increments,warnings,correspondence}/
│   │   ├── admin/{petty-cash,accommodation,suppliers,subcontractors,bills,certificates}/
│   │   ├── documents/
│   │   ├── tasks/
│   │   ├── it/{helpdesk,assets,servers,network,ip-phones,cctv,software,vault}/
│   │   ├── vehicles/{list,maintenance,handovers}/
│   │   ├── insurance/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── audit/
│   │   └── settings/{general,users,roles,departments,templates,checklists}/
│   └── api/
│       ├── auth/[...all]/           # Better Auth handler
│       ├── files/[id]/              # authorised download proxy
│       └── cron/expiry-scan/        # secret-protected job endpoint
├── components/
│   ├── ui/                          # shadcn primitives
│   ├── data-table/                  # DataTable + toolbar + column visibility
│   ├── forms/                       # FormField, DatePicker, FileUpload, EntitySelect
│   └── shared/                      # PageHeader, StatusBadge, EmptyState, ExpiryAlert…
├── server/
│   ├── actions/                     # one file per module
│   ├── services/                    # one folder per domain
│   ├── auth/                        # auth.ts, permissions.ts, guards.ts
│   ├── db/                          # client.ts, extensions.ts
│   ├── audit/, storage/, crypto/, notifications/
├── lib/                             # result.ts, expiry.ts, format.ts, constants.ts
└── types/
prisma/
├── schema/                          # split schema files (Prisma 7 multi-file)
├── migrations/
└── seed.ts
docs/
```

## 6. Server Action pipeline

Every mutation runs the same seven steps. Rather than repeat them ~200 times, one wrapper enforces the order:

```ts
export const updateEmployee = defineAction({
  permission: "employees.update",
  schema: updateEmployeeSchema,
  audit: { entity: "Employee", action: "UPDATE" },
  handler: async ({ input, ctx, audit }) => {
    const before = await employeeService.byId(ctx, input.id);
    const after  = await employeeService.update(ctx, input);
    audit.record({ entityId: after.id, before, after });
    return after;
  },
  revalidate: (input) => [`/people/employees/${input.id}`, "/people/employees"],
});
```

The wrapper: authenticates → resolves permissions → checks the declared permission → validates with Zod → applies company scope to `ctx` → runs the handler → writes the audit entry (with field redaction) → revalidates paths → returns a `ActionResult`.

**Uniform result type** (`lib/result.ts`):

```ts
type ActionResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> };
```

Services throw typed `AppError` subclasses (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`); the wrapper is the single place that translates them into a safe `ActionResult`. Stack traces and Prisma error text never cross that boundary — they are logged server-side with a correlation id that is surfaced to the user as a reference code.

## 7. Rendering and data-fetch strategy

- **Server Components by default.** Lists, detail pages, dashboards, and reports fetch through services directly — no client fetching, no loading spinners for initial paint.
- **Client Components** only for: forms, dialogs/sheets, the command menu, table interaction, charts, file upload, and the vault reveal control.
- **Tables are server-driven.** Page, sort, filter, and search live in the URL (`?page=2&sort=expiryDate.asc&company=KWI`). This makes every list view shareable and bookmarkable, and keeps thousands of rows out of the browser.
- **Streaming** via `loading.tsx` + `<Suspense>` so dashboard KPI cards paint before the slower activity feed.
- **`cache()`** wraps per-request session and permission resolution so repeated `requirePermission()` calls in one render cost one query.

## 8. Multi-company model

Company is a first-class dimension, not a label. Every operational table carries `companyId`. Access is governed by `UserCompanyAccess` rows; the actor context carries a resolved `companyScope: string[] | "ALL"`, and services apply it in the `where` clause rather than filtering after the fact.

**Resolved by Decision C:** scoping is enforced, with `companies.viewAll` as the documented cross-company override for group management. A user with access to KWI only cannot read, list, count, or export an ICC record through any path.

## 9. Resolved decisions

All four blocking decisions were answered by the product owner on 2026-08-10. Phase 2 is unblocked.

| # | Decision | Answer | Consequence |
|---|---|---|---|
| **A** | Deployment target | **Vercel + Neon** | Vercel Cron drives the reminder engine (`/api/cron/expiry-scan`, `CRON_SECRET`-protected). Rate limiting is DB-backed via `RateLimitBucket` — no Redis. PDF runs on the Node runtime with raised `maxDuration`. |
| **B** | File storage | **UploadThing** | See ADR-008. Private ACL mandatory, post-upload magic-byte validation, PDPL residency flagged. |
| **C** | Company isolation | **Scoped, with cross-company override** | `UserCompanyAccess` drives `ctx.companyScope`; `companies.viewAll` grants group-wide visibility. Every query on a company-owned table applies `companyScopeWhere(ctx)`. |
| **D** | Arabic | **Arabic data + bilingual letters, English UI** | Chromium-based PDF (ADR-004). Arabic name/profession/title fields already in the schema. **No app-wide i18n or RTL layer** — saves substantial Phase 4 work. Letter templates carry `bodyHtml` per language with `dir="rtl"` on Arabic blocks. |

### What Decision D does *not* include

The UI stays English-only. Arabic appears in three places: stored data (`nameAr`, `fullNameAr`, `professionAr`, `titleAr`), letter templates, and generated PDFs. If a full Arabic UI is wanted later it is a genuine project, not a toggle — noted in `DEVELOPMENT.md` §10.

## 10. Assumptions taken without asking (documented per §56)

1. **Notifications are in-app first.** Delivery is written behind a `NotificationChannel` interface so email (Resend/SMTP) can be enabled later without touching the rules engine.
2. **No payroll.** Salary appears only where the brief requires it (offers, increments, letters). No payroll runs, deductions, or GOSI calculations.
3. **No SSO / MFA in v1.** Better Auth supports both; the schema and config leave room. MFA is recommended for `SUPER_ADMIN` and vault users as a fast follow.
4. **Leave balances are not accrued automatically.** Requests are recorded and approved; accrual policy engines are out of scope unless asked for.
5. **Soft delete is selective**, not universal — see `DATABASE.md` §8.
6. **English UI, Gregorian dates.** Hijri date display was not requested and is deferred; it is a display-layer addition, not a schema change, so it stays cheap to add later.

## 11. What "done" means

A module is complete when it has: server-side authorisation, Zod validation, list + detail + create + edit + delete flows, loading/empty/error states, audit entries on mutations, responsive behaviour, and passes `lint` + `tsc --noEmit` + `prisma validate` clean. Partial modules are reported as partial.
