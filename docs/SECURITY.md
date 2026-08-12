# SECURITY DESIGN

Security architecture for the OMS. **Proposed — pending approval.**

This system stores personal data (Iqama numbers, passports, salaries, IBANs) and company credentials. It is treated as a high-value internal target, not a CRUD app with a login page.

---

## 1. Threat model

| # | Threat | Realistic scenario | Primary control |
|---|---|---|---|
| T1 | Horizontal privilege escalation | HR user edits the URL to view another company's employees | Server-side company scoping on every query |
| T2 | Vertical privilege escalation | `USER` calls a Server Action directly to approve their own leave | Permission check inside the action pipeline, never in the UI |
| T3 | Credential theft from DB | Database dump, Neon branch copy, or stolen backup | Envelope encryption; KEK never in the database |
| T4 | Insider credential harvesting | IT staff member bulk-reveals the vault before resigning | Per-reveal audit, rate limiting, vault unlock, export permission split |
| T5 | Direct object reference on files | Guessing/sharing a document URL to read someone's passport scan | Private ACL on every file; authorisation-gated downloads issuing 60 s signed URLs; no file URL ever rendered or stored |
| T6 | Secret leakage through logs | Password appears in a server log, error message, or audit diff | Central redaction list; ciphertext never logged; no secrets in GET |
| T7 | Credential stuffing / brute force | Reused password from a breach | Argon2id, per-account lockout, rate limiting |
| T8 | Malicious file upload | `.svg` with script, or `.exe` renamed to `.pdf` | Magic-byte validation, MIME allowlist, size caps, no inline HTML/SVG rendering |
| T9 | Session hijacking | Stolen cookie on a shared office machine | HttpOnly + Secure + SameSite, short vault sessions, session revocation |
| T10 | Data exfiltration via export | Bulk CSV of all employees | `*.export` as separate permissions, exports audited |
| T11 | Tampering with the audit trail | User deletes evidence of their own action | Audit log is append-only; no delete path exists in the application |

---

## 2. Authentication

**Better Auth `1.6.26`**, email + password, Node.js runtime (Argon2 is a native module and cannot run on edge).

### Password hashing (ADR-002)

`@node-rs/argon2` with Argon2id:

```
memoryCost  = 19456 KiB (19 MiB)
timeCost    = 2
parallelism = 1
outputLen   = 32
salt        = 16 bytes, per-hash, library-generated
```

These are the OWASP-recommended Argon2id parameters (the 19 MiB / t=2 profile). Hashes are stored with their parameters embedded in the PHC string, so parameters can be raised later and hashes upgraded transparently on next successful login.

### Password policy

- Minimum 12 characters, no composition rules (length beats character classes)
- Checked against a bundled list of the most common breached passwords
- Rejected if it contains the user's email local-part or name
- No forced rotation — rotation is required only on suspected compromise or `mustChangePassword`
- Change-password requires the current password and revokes all *other* sessions

### Account protection

| Control | Value |
|---|---|
| Failed-login lockout | 10 failures → 15-minute lock (`User.failedLoginCount`, `lockedUntil`) |
| Rate limit — login | 5 attempts / 15 min per email **and** per IP (`RateLimitBucket`) |
| Rate limit — password reset | 3 / hour per email |
| Login response timing | Identical message and comparable timing for unknown email vs wrong password |
| Disabled accounts | `User.status != ACTIVE` fails auth and invalidates existing sessions |

#### These controls live in Better Auth hooks, not in the login action

`/api/auth/sign-in/email` is a **public endpoint**. An earlier implementation put
rate limiting, lockout, and audit logging inside the `loginAction` Server Action;
posting directly to that route bypassed all three. Verified by doing exactly
that: sessions were issued with no audit entry, no counter increment, and no
rate-limit bucket.

They now live in `src/server/auth/login-hooks.ts`, wired to Better Auth's
`hooks.before` / `hooks.after`, so they apply to **every** path into sign-in.
`loginAction` is a thin caller that only maps errors for the form.

**Rule for any future auth surface:** a security control belongs on the hook, not
the caller. If it can be reached without going through your code, it is not
enforced.

#### Two rate limiters, one authority

Better Auth ships its own limiter, in-memory by default — per-instance, so
unreliable on serverless — and its default sign-in rule is stricter than ours,
which silently masked our limit and made the effective threshold depend on which
instance served the request.

Resolved by making our **database-backed** limiter the binding constraint
(5 / 15 min) and widening Better Auth's sign-in rule to 30 / 15 min so it never
fires first, while remaining a coarse backstop on other auth endpoints.
Verified: attempts 1–5 return 401, the 6th returns 429.

### Sessions

- Server-side sessions in Postgres (not stateless JWT) so revocation is immediate and real
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix in production
- Absolute lifetime 7 days; rolling refresh on activity; idle expiry 8 hours
- `ipAddress` and `userAgent` recorded per session; user-visible active-session list with "sign out everywhere"
- Sign-out and password change revoke server-side, not just the cookie

### Deferred (schema leaves room)

MFA/TOTP and SSO are not in v1. **Recommendation:** enable TOTP for `SUPER_ADMIN` and any user holding `vault.reveal` as the first post-launch hardening step.

---

## 3. Authorisation

### Three independent gates

Every request passes all three. Failing any one denies.

```
1. AUTHENTICATED?   valid session, user ACTIVE, not locked
2. PERMITTED?       effective permission set contains the required key
3. IN SCOPE?        row belongs to a company/department/owner the actor may see
```

Gate 3 is the one most systems forget. A permission check alone would let an HR user at KWI edit an ICC employee.

### Helpers (single implementation, `server/auth/guards.ts`)

```ts
requireAuth(): Promise<ActorContext>
requirePermission(key: PermissionKey): Promise<ActorContext>
requireAnyPermission(keys: PermissionKey[]): Promise<ActorContext>
requireCompanyAccess(ctx, companyId): void
requireVaultUnlocked(ctx): Promise<VaultContext>
```

`ActorContext` is the only thing services accept:

```ts
type ActorContext = {
  userId: string;
  roleKey: string;
  permissions: ReadonlySet<PermissionKey>;
  companyScope: string[] | "ALL";
  employeeId: string | null;
  departmentScope: string[] | "ALL";
  ip: string | null;
  userAgent: string | null;
};
```

Because services never read the session themselves, a service cannot accidentally run unauthenticated — there is no ambient identity to fall back on.

### Scoping is applied in the query, not after it

```ts
// correct — the database never returns out-of-scope rows
const where = { ...filters, ...companyScopeWhere(ctx) };

// forbidden — leaks row counts, pagination is wrong, easy to forget
const all = await prisma.employee.findMany(filters);
return all.filter(e => ctx.companyScope.includes(e.companyId));
```

`companyScopeWhere(ctx)` returns `{}` for `"ALL"` and `{ companyId: { in: ctx.companyScope } }` otherwise. Review rule: any `findMany` on a company-owned table without a scope helper is rejected.

### Derived copies inherit the gates of their source

A generated letter is employee data in another shape. `letters.view` alone would
therefore be a way around `employees.salary.view`: generate a salary certificate,
then read the figure off the letter. VIEWER holds every non-sensitive `.view`
permission, `letters.view` among them, so this was reachable by the least
privileged role in the system.

The rule, enforced in `getGeneratedLetter`:

```ts
where: {
  id,
  ...companyScopeWhere(ctx),
  // filtered in the query — a hidden row is indistinguishable from a missing one
  ...(ctx.permissions.has("employees.salary.view") ? {} : { containsSalary: false }),
}
```

`GeneratedLetter.containsSalary` is recorded **per letter at generation time**,
reflecting whether a salary figure actually rendered into the body — not
inferred from the template type. Any template can reference `{{salary}}`, and a
`{{salary}}` that rendered as an unresolved placeholder leaks nothing and must
not lock the letter away from the people who need it.

The list view still shows these rows: the metadata (number, type, employee) is
not the secret. The row is rendered locked rather than linked, so the reason is
visible instead of arriving as a 404 on click.

Generalise this when adding any feature that copies data into a new record:
exports, reports, and PDF snapshots need the same treatment.

### Reports and exports share one column derivation

A report export is the widest version of the same problem — a second read path
across every domain table at once. It is handled structurally rather than by
remembering to repeat the check:

```ts
// lib/reports.ts — the ONLY place visible columns are decided
visibleColumns(report, ctx.permissions)
```

The page and `/api/reports/[reportId]/export` both call it, so a gated column
cannot be absent from the screen yet present in the file. Two further layers sit
behind it:

- the service never **selects** a gated field — `salaryByEmployee` and
  `ibanByEmployee` are separate queries that simply do not run without the
  permission, so a bug in the renderer or exporter has nothing to leak;
- `reports.export` is checked in the route itself, not only in the page that
  links to it.

Verified live across four roles plus a purpose-built user holding
`reports.export` with a DENY override on `employees.salary.view` — the case that
actually exercises column gating in the export path. Its export header ends at
`Iqama Expiry`; HR's continues `…, Basic Salary, IBAN`.

Every export writes an audit row recording the report, format, row count, filters,
and **which columns left the system** — the question asked after an incident. Row
values are never recorded.

### Client-side permission checks are cosmetic only

`<Can permission="employees.delete">` hides buttons. It is a UX affordance and carries **no** security weight; the corresponding Server Action re-checks independently. Both exist; only the server one matters.

---

## 4. Server Action & Route Handler security

Every Server Action is a public HTTP endpoint. Treated as such:

1. **Authenticate first, always** — before reading input.
2. **Authorise before validating** — do not leak schema shape to unauthorised callers.
3. **Validate with Zod, then use only the parsed output** — never the raw input object.
4. **Never accept an actor id from the client.** `createdById`, `uploadedById`, `userId` come from `ctx`, never from the request body.
5. **Re-verify ownership on ids in the payload.** A task id in the body is verified against scope before mutation.
6. **Mass-assignment protection** — Zod schemas are explicit allowlists; `.strict()` rejects unknown keys, so `{ role: "SUPER_ADMIN" }` in a profile update is a validation error, not a privilege escalation.
7. **Return only projected data.** Services `select` explicit fields; entities are never returned raw.

**CSRF:** Next.js Server Actions are POST-only with an origin check, and session cookies are `SameSite=Lax`. Route Handlers that mutate additionally verify `Origin` against `APP_URL`.

**Rate limiting** on sensitive endpoints via the `RateLimitBucket` table (no Redis dependency, works on serverless): login, password reset, vault unlock, vault reveal, file download, report export, global search.

---

## 5. Password Vault — cryptographic design

The most sensitive module. Designed so that **a full database compromise does not yield a single plaintext password.**

### 5.1 Envelope encryption

```
        ┌──────────────────────────────────────────────┐
        │  KEK — Key Encryption Key                    │
        │  32 bytes, base64, env var VAULT_KEK_V1      │
        │  NEVER stored in the database                │
        └───────────────────┬──────────────────────────┘
                            │ AES-256-GCM wrap
                            ▼
        ┌──────────────────────────────────────────────┐
        │  DEK — Data Encryption Key                   │
        │  random 32 bytes, unique PER CREDENTIAL      │
        │  stored only as wrappedDek (ciphertext)      │
        └───────────────────┬──────────────────────────┘
                            │ AES-256-GCM encrypt
                            ▼
        ┌──────────────────────────────────────────────┐
        │  Credential.ciphertext + iv + authTag        │
        └──────────────────────────────────────────────┘
```

**Why envelope rather than encrypting directly under the KEK:**
- KEK rotation re-wraps small DEKs instead of re-encrypting every secret
- A leaked single DEK exposes exactly one credential
- `keyVersion` per row allows a gradual, resumable rotation

### 5.2 Parameters

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM (authenticated — detects tampering) |
| IV | 12 bytes, `crypto.randomBytes`, **unique per encryption** |
| Auth tag | 16 bytes, stored separately |
| **AAD** | the credential's `id` |
| Key source | `VAULT_KEK_V{n}` env var, base64, 32 bytes |
| Storage type | `Bytes` (`bytea`), not base64 text |

**The AAD matters.** Binding the ciphertext to its row id means an attacker with write access cannot copy the encrypted admin password into a low-value credential row and reveal it through a permission they legitimately hold. Decryption of a moved ciphertext fails the authentication check.

### 5.3 Key management

- KEK lives in the platform secret store (Vercel Environment Variables / Docker secret / systemd `EnvironmentFile` with `0600`) — never in the repo, never in the database, never in `NEXT_PUBLIC_*`.
- Startup validates that the KEK exists, is 32 bytes after base64 decode, and is not the development placeholder. The app **refuses to boot** otherwise rather than silently starting a broken vault.
- Rotation: add `VAULT_KEK_V2`, run `pnpm vault:rotate-kek` (re-wraps DEKs, bumps `keyVersion`, works in batches and is resumable), retire V1 after all rows report V2.
- A documented break-glass procedure covers KEK loss: **the data is unrecoverable by design**. The KEK is backed up in the company's offline secret store, and this is stated plainly to the product owner rather than buried.

### 5.4 Vault unlock (auto-lock)

Holding `vault.reveal` is not sufficient to reveal a secret. The user must additionally unlock:

```
POST /it/vault/unlock  { password }
  → re-verify the user's password with Argon2
  → mint 32-byte random token; store SHA-256(token) in VaultSession
  → set separate HttpOnly cookie, 15-minute expiry, sliding on use
  → audit VAULT_UNLOCK
```

- Idle timeout 15 minutes, absolute maximum 8 hours
- Client-side inactivity timer clears revealed values from React state and calls lock
- Logout, password change, and permission change revoke all `VaultSession` rows
- The unlock token is stored **hashed** — a database dump does not yield usable unlock tokens

### 5.5 Reveal path

```
POST /it/vault/[id]/reveal      ← POST only; id in path, secret in response body
  1. requireAuth
  2. requirePermission("vault.reveal")
  3. requireVaultUnlocked
  4. check CredentialGrant for this credential/category (level REVEAL or MANAGE)
  5. rate limit: 10 reveals / 5 min / user  → exceeded = deny + high-severity alert
  6. unwrap DEK with KEK → decrypt with AAD = credential.id
  7. write CredentialAccess { action: REVEAL } and AuditLog
  8. return { password } with Cache-Control: no-store
```

**Never:**
- a `GET` route (URLs land in browser history, proxy logs, and referrers)
- included in list or detail responses — reveal is a separate, explicit call for exactly one credential
- written to `localStorage`, `sessionStorage`, or any client cache
- logged, at any level, in any environment
- returned in bulk — there is no "reveal all"; `vault.export` is a separate permission and every exported row is individually audited

### 5.6 Vault access separation

Per §27 of the brief, HR/Admin must not reach IT credentials. Two independent layers:

1. **Global permissions** — `vault.*` is absent from the `HR`, `ADMIN`, `MANAGER`, `USER`, and `VIEWER` seed roles entirely.
2. **Per-credential ACL** — `CredentialGrant` scopes access by credential or category. An IT technician may hold `vault.reveal` globally yet still be denied the `GOVERNMENT` category.

Effective access = global permission **AND** grant. Both must pass.

### 5.7 Vault audit

`CredentialAccess` records `LIST | VIEW | REVEAL | COPY | CREATE | UPDATE | DELETE | ROTATE` with user, IP, user-agent, timestamp. It **never** stores the credential value, old or new. `CredentialVersion` retains previous ciphertexts for rollback, encrypted exactly like the current one — history is not a plaintext backdoor.

A "recently revealed" panel and an alert on anomalous reveal volume give the IT manager a real chance of noticing T4.

---

## 6. File security (UploadThing)

Storage is **UploadThing `7.7.4`** (ADR-008). Because uploads go browser → UploadThing directly, the validation order differs from a classic proxied upload, and the design accounts for that explicitly rather than assuming pre-upload inspection is possible.

### 6.0 Current status: uploads BLOCKED (verified 2026-08-10)

The configured UploadThing app is on the free tier, which does not support
private files. Measured, not assumed — `pnpm tsx scripts/verify-storage.ts`:

- `acl: "private"` → **HTTP 400**, *"Private files are not allowed for free apps."*
- default ACL → accepted, and the **unsigned URL returns HTTP 200** (world-readable)

Every route declares `acl: "private"`, so uploads **fail rather than publish**.
The control worked; the feature does not. Resolution options are in
`ARCHITECTURE.md` ADR-008 and need a product-owner decision.

**Do not "fix" this by dropping the ACL.** Uploads would start succeeding and
every passport and Iqama scan would be readable by anyone with the URL.

### 6.1 Private by default — non-negotiable

UploadThing defaults to `public-read`, which would expose every passport scan to anyone with the URL (threat T5). Three layers prevent that:

1. **Every file route declares `acl: "private"`.**
2. **The app-level default ACL is set to private** in the UploadThing dashboard, and the private-ACL permission is enabled.
3. **A startup assertion** verifies the configured default is private and **refuses to boot** otherwise. A dashboard toggle is not an acceptable single point of failure for passport data.

No UploadThing URL — signed or otherwise — is ever rendered into a page, stored in `Document`, or returned by a list endpoint.

### 6.2 Upload pipeline

```
① Client requests upload  → f({...}).middleware()
     requireAuth + requirePermission(documents.upload)
     resolve company scope; attach { userId, companyId, entityType, entityId }
     ↓ (unauthorised uploads never reach storage)
② Browser uploads directly to UploadThing (acl: private)
     route-level limits: maxFileSize, maxFileCount, allowed types
     ↓
③ onUploadComplete — the real gate
     fetch leading bytes via 60 s signed URL
     verify MAGIC BYTES against declared MIME
     verify size, compute SHA-256
     ✗ mismatch → utapi.deleteFiles(key); NO FileObject row is created
     ✓ pass     → FileObject { scanStatus: CLEAN, detectedType, checksum }
     ↓
④ Only rows with scanStatus = CLEAN are visible to the application
```

The application treats a file as non-existent until step ④. A file that fails validation is deleted from storage and leaves no reachable record.

### 6.3 Validation rules

| Check | Rule |
|---|---|
| Extension allowlist | `pdf, jpg, jpeg, png, webp, doc, docx, xls, xlsx` |
| MIME allowlist | Declared type must match the extension |
| **Magic bytes** | Sniffed in `onUploadComplete`; mismatch → file deleted |
| Size | 10 MB default, 25 MB for `xlsx` imports; enforced by route config **and** re-checked server-side |
| Filename | Never used as a storage key; never interpolated into a path or header unescaped |
| SVG | **Rejected** — executable markup |
| Archives / executables | Rejected |
| `contentDisposition` | `attachment` on all routes except previewable PDF/image |
| Checksum | SHA-256 recorded for integrity and duplicate detection |

### 6.4 Download authorisation

Files are **never** linked directly. All access goes through `GET /api/files/[id]`:

```
1. requireAuth
2. load FileObject → reject unless scanStatus = CLEAN
3. resolve owning Document/Attachment → resolve owning entity
4. apply company + module scope (requireCompanyAccess)
5. requirePermission (e.g. documents.download)
6. utapi.generateSignedURL(fileKey, { expiresIn: 60 }) → redirect, or proxy bytes
7. audit DOWNLOAD
```

`generateSignedURL()` signs locally with no API round-trip. Expiry is **60 seconds** — long enough to fetch, too short to share. UploadThing permits up to 7 days; we deliberately do not use that.

Response headers: `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` (so a signed URL cannot leak through a referrer header).

### 6.5 Residual risks — stated, not hidden

| Risk | Assessment |
|---|---|
| **Cross-border data residency** | Files rest on third-party infrastructure outside Saudi Arabia. Iqama/passport scans are personal data under PDPL, which restricts transfer. **A business decision for the product owner**, flagged before go-live. The `StorageProvider` interface keeps a move to a regional bucket contained. |
| **Malicious bytes exist in storage briefly** | Between steps ② and ③ an invalid file is stored. It is private, unreferenced, and deleted within the same request. No user can reach it — no `FileObject` row means no route resolves it. |
| **No antivirus scanning** | Magic-byte validation catches type confusion, not malware. `scanStatus` exists precisely so an AV step can be inserted later without a schema change. |
| **Vendor availability** | An UploadThing outage stops uploads and downloads. Acceptable for an internal tool; noted so it is a known dependency rather than a surprise. |

---

## 7. Audit logging

### What is recorded

Every mutation through the action pipeline, plus explicit `VIEW`/`DOWNLOAD` on sensitive resources (credentials, bank details, salary data, documents, exports).

```
actorUserId, actorLabel, action, entityType, entityId, companyId,
summary, changes (field-level before/after), ipAddress, userAgent, createdAt
```

`actorLabel` is denormalised so the trail stays readable after a user is deleted.

### Redaction — mandatory

A central `REDACTED_FIELDS` set is applied to every `changes` diff before it is written:

```
password, passwordHash, ciphertext, wrappedDek, iv, authTag,
token, tokenHash, secret, apiKey, iban, accountNo,
notesCipher, sessionToken
```

Redacted fields record `"[REDACTED]"` for both before and after — the *fact* of the change is auditable, the value is not. IBAN and salary changes log that they changed and by whom, never the values.

### Integrity

- No application code path deletes or updates an `AuditLog` row — writes are insert-only.
- Database privileges follow: the application role gets `INSERT`/`SELECT` on `AuditLog` and `CredentialAccess`, not `UPDATE`/`DELETE`.
- Retention is configurable; archival exports are themselves audited.

---

## 8. Input, output, and injection

| Vector | Control |
|---|---|
| SQL injection | Prisma parameterises everything. The few `$queryRaw` uses (trigram search, partial indexes) use tagged templates with parameters — never string concatenation |
| XSS | React escapes by default. `dangerouslySetInnerHTML` is used **only** for the letter preview and the letter print view, and only on server-sanitised HTML (allowlist of tags/attributes/style properties; no `<script>`, no `on*`, no `javascript:`, no `url()`). Sanitisation runs on save **and** again on render, so a body stored before a rule tightened cannot become exploitable |
| Template injection | Letter variables are resolved from a declared allowlist and HTML-escaped at substitution; templates cannot execute arbitrary expressions. A substituted value is never re-scanned for placeholders, so a value containing `{{salary}}` cannot expand |
| Open redirect | Post-login redirect accepts relative paths only, validated against a route allowlist |
| SSRF | No user-supplied URL is fetched server-side |
| Prototype pollution | Zod `.strict()` on all schemas; no `Object.assign` from raw request bodies |
| Excel formula injection | Cells beginning `=`, `+`, `-`, `@`, tab, or CR are prefixed with `'` in `lib/export.ts`, applied to **both** CSV and `.xlsx` — a `.xlsx` cell whose value starts `=` is executed just the same. Verified against `=HYPERLINK("…"&A1)` planted in an employee name: the exported cell is inert in both formats, and the `.xlsx` contains zero `<f>` formula elements |
| Header injection via export filename | `safeFilename` strips CR/LF, quotes, and path separators before the value reaches `Content-Disposition` |
| Enumeration | cuid2 ids; identical error responses for "not found" and "not permitted" |

### Security headers (`next.config.ts` + middleware)

```
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 9. Secrets & configuration

Nothing secret is committed. `.env*` is git-ignored from the first commit; `.env.example` documents every variable with placeholders only.

```bash
DATABASE_URL=                 # Neon pooled connection
DIRECT_URL=                   # Neon direct — migrations only
BETTER_AUTH_SECRET=           # 32+ random bytes
BETTER_AUTH_URL=
APP_URL=
VAULT_KEK_V1=                 # base64, exactly 32 bytes — vault master key
UPLOADTHING_TOKEN=            # UploadThing app token (server-only)
CRON_SECRET=                  # protects /api/cron/* — Vercel Cron
SEED_ADMIN_PASSWORD=          # development seed only
```

Rules:
- Validated at startup with a Zod schema — a missing or malformed secret is a **boot failure**, not a runtime surprise on first use.
- `NEXT_PUBLIC_*` is reserved for genuinely public values. A review check greps for secrets under that prefix.
- Server-only modules import `server-only`, so a client import of the crypto or db module is a build error.
- Cron routes require `Authorization: Bearer ${CRON_SECRET}` compared with a timing-safe equality function.

---

## 10. Privacy considerations

The system holds Saudi national/residency identifiers and financial data.

- **Field-level access:** Iqama and passport numbers are masked (`····5678`) in list views; full values require opening the record, and the reveal is audited.
- **Bank details** live in their own table behind `employees.bank.view`, held by HR only.
- **Salary** is behind `employees.salary.view`, separate from the general employee permission.
- **Exports** are separately permissioned and individually audited — the most likely bulk-exfiltration path.
- **Data minimisation:** no data is collected that no screen or report uses.

---

## 11. Phase 13 security review checklist

Executed before the system is declared complete. Each item is verified by reading code, not by assertion.

- [ ] Every Server Action begins with `requireAuth` + `requirePermission`
- [ ] Every `findMany` on a company-owned table applies `companyScopeWhere`
- [ ] No client-supplied actor id is trusted anywhere
- [ ] Every Zod schema is `.strict()`
- [ ] Vault: KEK absent from DB, git history, and logs; AAD applied; reveal is POST-only, unlocked, rate-limited, audited
- [ ] `grep -ri "password" src/server` finds no logging of credential values
- [ ] All file downloads pass through `/api/files/[id]`; no UploadThing URL is ever rendered or stored
- [ ] Every UploadThing route declares `acl: "private"`; app default ACL is private; boot assertion active
- [ ] `onUploadComplete` magic-byte validation active; failures delete the file and create no `FileObject`
- [ ] Signed URLs expire in 60 s; `Referrer-Policy: no-referrer` on file responses
- [ ] SVG, archives, and executables rejected
- [ ] Audit redaction list applied to every diff writer
- [ ] No `AuditLog` update/delete path exists
- [ ] Security headers present on every response
- [ ] Rate limits active on login, reset, unlock, reveal, export, search
- [ ] Env validation fails closed at boot
- [ ] `npm audit` clean of high/critical
- [ ] Seeded roles: `HR`/`ADMIN` hold zero `vault.*` permissions
- [ ] Error responses leak no stack traces, Prisma messages, or schema details
- [ ] Sessions revoked on logout, password change, role change, and deactivation
