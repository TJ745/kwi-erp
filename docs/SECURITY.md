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
| T5 | Direct object reference on files | Guessing/sharing a document URL to read someone's passport scan | Authorisation-gated downloads that **stream** the bytes, never redirect; no storage URL rendered, stored, or allowed by CSP. Object privacy depends on the tier — on the free tier the object is public and the URL is the secret (§6.0) |
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

### 5.7 Per-credential grants

`CredentialGrant` narrows access; it does not widen it. A credential with no
grants is reachable by anyone holding the global vault permission. The moment
one grant exists, only the people and roles named by a grant can reach it —
**and there is no administrator exemption**. That was established by experiment
rather than assumed: a credential visible to a SUPER_ADMIN became invisible to
them the instant a grant naming somebody else was added.

Because of that, `createCredentialGrant` and `revokeCredentialGrant` both refuse
any change that would leave nobody able to manage the credential. "Able" is
effective, not nominal: a user needs the global `vault.update` permission *and*
a matching MANAGE grant, so granting MANAGE to someone who lacks the permission
is still refused. Without that guard, one careless grant would lock the
organisation out of a credential permanently, recoverable only from the database.

The predicate itself lives in `lib/vault-grants.ts` as a pure function with 18
tests covering the combinations that matter — expiry exactly at now, a grant
through a role, a grant naming nobody, a MANAGE grant held by somebody without
`vault.update`. It was extracted precisely because it could not be tested any
other way: the original version needed a database, four related tables, and a
cron run to answer one boolean.

Verified live, before and after that extraction:

| Attempt | Result |
|---|---|
| Grant READ to one user, leaving nobody with MANAGE | `CONFLICT` |
| Grant MANAGE to a user lacking `vault.update` | `CONFLICT` — nominal access is not access |
| Grant MANAGE to a user holding it | accepted |
| Effect of that grant | granted user still sees it; a non-grantee no longer does |
| Revoke the only grant | accepted; the credential returns to open |
| Any of the above without `vault.grant` | `FORBIDDEN` |

The UI states the direction before the first grant is added, because someone
reading "grant" as "give one more person access" would quietly cut everyone else
off.

### 5.7a Vault audit

`CredentialAccess` records `LIST | VIEW | REVEAL | COPY | CREATE | UPDATE | DELETE | ROTATE` with user, IP, user-agent, timestamp. It **never** stores the credential value, old or new. `CredentialVersion` retains previous ciphertexts for rollback, encrypted exactly like the current one — history is not a plaintext backdoor.

A "recently revealed" panel and an alert on anomalous reveal volume give the IT manager a real chance of noticing T4.

---

## 6. File security (UploadThing)

Storage is **UploadThing `7.7.4`** (ADR-008). Because uploads go browser → UploadThing directly, the validation order differs from a classic proxied upload, and the design accounts for that explicitly rather than assuming pre-upload inspection is possible.

### 6.0 Storage tier — accepted risk (product-owner decision, 2026-08-12)

The UploadThing free tier does not support private files. Measured, not assumed:

- `acl: "private"` → **HTTP 400**, *"Private files are not allowed for free apps."*
- default ACL → accepted, and the **unsigned URL returns HTTP 200** (world-readable)

**The product owner has chosen to run the free tier** (confirmed 2026-08-18),
accepting that stored documents are readable by anyone who obtains the object
URL. This is no longer a temporary state pending an upgrade; it is the chosen
configuration.

What that means in practice, stated once so nobody has to infer it later: an
Iqama or passport scan needs **no session** to read, only the URL. The
application never discloses one — downloads stream through `/api/files/[id]`,
no storage URL is stored or rendered, and the CSP does not allow the storage
host — so a URL escapes only through a server compromise, a database dump, or
someone deliberately copying it out. Setting `UPLOADTHING_TIER=pro` remains a
one-variable change if that trade stops being acceptable.

`UPLOADTHING_TIER` is the whole switch:

| | `free` (current) | `pro` |
|---|---|---|
| Route ACL | omitted — declaring one is rejected | `private` |
| Object readable by URL | **yes, to anyone** | no |
| Read URL | signed, else public fallback | signed, 60 s |
| Production | requires `ACCEPT_PUBLIC_FILE_STORAGE=true` | allowed |

Upgrading is that one variable. No other change.

#### What the URL being the only secret means, and what is done about it

The object key is 48 random characters, so it is not enumerable. The exposure is
disclosure of a URL, not discovery of one. Everything that could disclose one is
therefore closed:

1. **Downloads stream through the server.** `/api/files/[id]` authorises, then
   pipes the bytes. It does **not** redirect — no `Location` header, no history
   entry, no referrer, nothing in devtools. Verified: the response carries no
   `ufs.sh`/`utfs.io` reference in body or headers.
2. **No storage URL is persisted or rendered.** `FileObject` stores the key, not
   a URL; nothing in the UI references the storage host.
3. **CSP does not allow the storage host.** `img-src 'self' data: blob:` — a
   future `<img src="https://….ufs.sh/f/…">` fails in the browser rather than
   relying on nobody writing one. `connect-src` still allows uploads.
4. **`readUrlFor` is documented server-only** and has exactly one caller.

Residual risk, stated plainly: anyone who obtains an object URL — from a server
log, a database dump, a backup, or a compromised server — can read that file
with no session, from anywhere, and revoking access means deleting the object.
The controls above prevent disclosure through the application; they cannot make
a public object private.

**Do not add the storage host back to CSP, and do not redirect to a storage URL.**
Both would turn an accepted, contained risk into an active leak.

Boot-time enforcement (`assertStorageAclPolicy`) fails the process if the route
declarations disagree with the tier in either direction: a `private` ACL on the
free tier would make every upload fail with HTTP 400, and a missing one on the
pro tier would publish identity documents.

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
| **Cross-border data residency** | Files rest on third-party infrastructure outside Saudi Arabia. Iqama/passport scans are personal data under PDPL, which restricts transfer. **Decided 2026-08-18: the product owner accepts UploadThing and non-KSA storage.** Recorded here as an accepted risk rather than an open question. If it is revisited, the storage module is the contained change — four files import UploadThing directly and no domain code knows who stores the bytes. |
| **Malicious bytes exist in storage briefly** | Between steps ② and ③ an invalid file is stored. It is private, unreferenced, and deleted within the same request. No user can reach it — no `FileObject` row means no route resolves it. |
| **No antivirus scanning** | Magic-byte validation catches type confusion, not malware. `scanStatus` exists precisely so an AV step can be inserted later without a schema change. |
| **Vendor availability** | An UploadThing outage stops uploads and downloads. Acceptable for an internal tool; noted so it is a known dependency rather than a surprise. |

---

## 6a. Email

> `/api/health` reports whether email is configured, but only to a caller
> presenting the cron secret. Publicly it answers just the health verdict:
> "storage tier is free" tells an attacker an object URL needs no session, and
> "email is off" tells them actions raise no outside alert. Neither grants
> access; both are gratuitous from an unauthenticated endpoint.


Email is the one channel that copies system data to somewhere with no permission
model. Three things follow from that, and all three are enforced rather than
intended:

**The message carries a link, not the record.** It reproduces the notification's
own title and body — which are written for an in-app list and are already
conservative — and then links into the app. The increment notification is the
worked example: it says a rise needs approval and names nobody's salary, because
`hr.increments.approve` does not imply `employees.salary.view`.

**No deep link to anything sensitive.** `targetPath` maps only known entity types
and falls back to `/notifications`. A vault credential notification gets the
fallback, never a link naming the credential.

**Titles are escaped.** They are assembled from record names, which are
user-supplied; an apostrophe in a surname would break the markup and a tag in one
would be worse. Ten template tests cover this, including a name containing a
script tag.

Provider errors are stored on the notification row, where administrators can read
them, so they are redacted before storage: anything shaped like an address or an
API key is replaced. Verified — a 401 from the provider recorded the status and
message with neither the key nor the recipient in it.

A recipient who is no longer `ACTIVE` is skipped rather than emailed: their access
is gone, so telling them about work they cannot open would be worse than silence.

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

Redacted fields record `"[REDACTED]"` for both before and after — the *fact* of the change is auditable, the value is not. Verified by exercising `redact()` against a hostile payload: `password`, `passwordHash`, `ciphertext`, and `iban` are all masked, and no secret value survives anywhere in the serialised output.

#### Salary figures are deliberately NOT redacted

`basicSalary` and the increment fields are **not** in `REDACTED_FIELDS`, and this is a decision rather than an oversight. For a financial approval, "who approved a raise, and to what figure" is the entire content of the audit record; masking the amount would leave a trail that cannot answer the question it exists for.

The consequence is a **permission coupling that must be respected when granting roles**:

> `audit.view` exposes salary figures through increment and contract entries.
> It must only be granted alongside `employees.salary.view`.

Today that holds by construction — only `SUPER_ADMIN` and `ADMIN` have `audit.view`, and both also have `employees.salary.view`. It would stop holding if a custom role, or a DENY override on `employees.salary.view`, were combined with audit access. The reports layer gates salary per column precisely because that combination is expressible; the audit log cannot do the same without destroying the record, so the constraint is stated here instead.

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

Completed 2026-08-13. Every item was verified by reading code and, where the
claim is observable, by exercising a running instance. Three items were rewritten
because they described a system that no longer exists — ticking them as written
would have been false.

Legend: **✅ verified** · **⚠️ changed** (rewritten, see note) · **➖ n/a**

| # | Item | Result |
|---|---|---|
| 1 | Every Server Action begins with `requireAuth` + `requirePermission` | ✅ Five of ~90 actions bypass `defineAction`; each was read individually. `loginAction`/`logoutAction` are pre-auth by nature; `changePasswordAction` calls `requireAuth`; `revealCredentialAction` and `generatePasswordAction` call `requirePermission` directly with `.strict()` schemas — deliberately outside the pipeline so a secret is never handed to the generic audit diff |
| 2 | Every `findMany` on a company-owned table applies `companyScopeWhere` | ✅ 167 company-owned queries enumerated. All are scoped, transitively scoped (ids sourced from a scoped query), deliberate system-wide scans (`reconcileExpiryIndex` and the reminder scans, documented in ADR-005), global uniqueness checks that **must** be global, or validators that compare `companyId` explicitly |
| 3 | No client-supplied actor id is trusted anywhere | ✅ No action schema accepts an actor id. `users.ts` accepts `userId` as the **target**, guarded by `requireSeniorTo` and a self-modification check. `uploadedById` comes from the upload middleware's `ctx.userId`; `generatedById`/`createdById` from `ctx` |
| 4 | Every Zod schema is `.strict()` | ⚠️ **Was false.** Six `update*Schema` were built as `z.object({ id }).and(base)`; a Zod intersection with a bare object silently stops rejecting unknown keys. Rebuilt as `baseObject.extend({ id })`, with cross-field rules shared through a typed `superRefine` so they are written once. 41 regression tests in `schemas/strictness.test.ts` |
| 5 | Vault: KEK absent from DB, git, and logs; AAD applied; reveal POST-only, unlocked, rate-limited, audited | ✅ No KEK column exists; git history holds only `replace-me` placeholders; no KEK reference outside `server/crypto` and `lib/env`. AAD is the credential id and is rejected when empty. Reveal is a Server Action (POST-only) enforcing permission → vault unlock → per-credential grant → rate limit → company scope → audit-without-value |
| 6 | `grep -ri "password" src/server` finds no logging of credential values | ✅ Every hit is a variable name, schema field, or audit summary. No `logger.*` call receives a secret, password, plaintext, or ciphertext |
| 7 | All file downloads pass through `/api/files/[id]`; no storage URL rendered or stored | ✅ One caller of `readUrlFor`; `FileObject` stores the key, not a URL; nothing in the UI references the storage host. Verified live — the download response carries no `ufs.sh`/`utfs.io` reference and issues no redirect |
| 8 | ~~Every UploadThing route declares `acl: "private"`~~ | ⚠️ **Rewritten.** The free tier rejects an explicit ACL with HTTP 400 (§6.0). Route ACLs must now match `UPLOADTHING_TIER`, enforced at boot by `assertStorageAclPolicy` in **both** directions: a private ACL on the free tier breaks every upload, a missing one on the pro tier publishes identity documents. 15 unit tests |
| 9 | `onUploadComplete` magic-byte validation active; failures delete the file and create no `FileObject` | ✅ Verified live end to end — a valid PDF was accepted and registered; the rejection path deletes the object before any row exists |
| 10 | ~~Signed URLs expire in 60 s; `Referrer-Policy: no-referrer` on file responses~~ | ⚠️ **Rewritten.** Signed URLs are still minted with a 60 s TTL and confirmed working on the free tier. The route-level `Referrer-Policy: no-referrer` was **removed**: `next.config.ts` sets the header globally and wins, so the route-level value was silently ignored — a header that looked like a control but was not. It is moot regardless, since the route streams rather than redirects and no storage URL reaches the browser |
| 11 | SVG, archives, and executables rejected | ✅ Allowlist of nine extensions; SVG rejected outright rather than sanitised; magic bytes are authoritative. `invoice.pdf.exe` resolves to `exe` and is refused — tested |
| 12 | Audit redaction list applied to every diff writer | ✅ `recordAudit` is the only writer taking before/after, and routes them through `diffRecords`. The single other `auditLog.create` is the system-actor path, which carries no diff |
| 13 | No `AuditLog` update/delete path exists | ✅ No `auditLog.update`/`delete`/`upsert` anywhere in `src/`. The model has no `updatedAt`, and `audit/log.ts` deliberately exposes no such helper |
| 14 | Security headers present on every response | ✅ Applied at `/:path*`. Confirmed live on an API response: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS |
| 15 | Rate limits active on login, reset, unlock, reveal, export, search | ⚠️ **Partly.** Active and verified: login, vault unlock, vault reveal, file download, report export. **Added during this review:** `passwordChange` (5 per 15 min). `changePasswordAction` had none, so anyone holding a stolen session could brute-force the current password without limit — and a success revokes the real user's other sessions, completing the takeover. Verified live: attempts 1–5 fail on the password, attempt 6 returns `RATE_LIMITED`. `passwordReset` and `globalSearch` remain declared but unwired ➖ because neither feature is built |
| 16 | ~~Env validation fails closed at boot~~ | ⚠️ **Rewritten.** Validation is lazy — on first `getEnv()` call, not at import — because eager validation runs during `next build`, where production secrets are legitimately absent, and failed the build instead of the deploy. Verified with an **invalid** `BETTER_AUTH_SECRET` rather than a missing one — `next start` loads `.env` files itself, so merely unsetting a shell variable proves nothing and the first attempt at this check was vacuous. With a too-short secret the production server still served `/login` with HTTP 200 while being unable to authenticate anyone. The error itself is correct when it fires (every problem listed, no values printed); what was overstated was *when*. `/api/health` now validates configuration and database reachability on demand so a broken deploy is detectable rather than merely latent |
| 17 | `npm audit` clean of high/critical | ⚠️ **Was not.** One high (`effect` < 3.20.0 — `AsyncLocalStorage` context contamination, and UploadThing carries per-request user identity through that machinery) and one moderate (`uuid` < 11.1.1 via `exceljs`). Both pinned through `pnpm-workspace.yaml` overrides; `pnpm audit` now reports **no known vulnerabilities** |
| 18 | Seeded roles: `HR`/`ADMIN` hold zero `vault.*` | ✅ Both hold none. `IT_ADMIN` holds view/reveal/create/update but **not** delete/export/grant. Only `SUPER_ADMIN` holds all seven |
| 19 | Error responses leak no stack traces, Prisma messages, or schema details | ✅ Only typed `AppError` messages — authored for users — reach the client. Anything else returns a generic message plus a correlation id, with the detail logged server-side |
| 20 | Sessions revoked on logout, password change, role change, and deactivation | ✅ Logout signs out; password change sets `revokeOtherSessions`; deactivation deletes both `Session` and `VaultSession`, verified live (a live session went from 200 to a login redirect). **Role change needs no revocation**: permissions resolve per request from the database. Verified live — promoting a user changed their access on the very next request with the same cookie, and demoting them removed it immediately. That is stronger than revocation, which has a race window |

### Penetration-style self-test

Run against a live instance with four seeded roles plus a purpose-built user.
Server Action ids were extracted from the public JavaScript bundles — exactly as
an attacker would — and the actions invoked directly with `curl`, bypassing the
UI entirely.

| Attack | Result |
|---|---|
| Unauthenticated access to six protected pages | 307 → `/login` on every one |
| VIEWER → `/it/vault`, `/settings/users`, `/settings/roles`, `/settings/templates` | 307 → `/no-access` on every one |
| HR → IT and vault pages | denied |
| VIEWER forging `createEmployeeAction` | `FORBIDDEN` |
| HR (KWI-scoped) forging an **ICC** employee | `FORBIDDEN` |
| HR injecting `employeeNo` + `deletedAt` (mass assignment) | `VALIDATION` — the item-4 fix, confirmed against a forged request |
| Brute-forcing the current password via a forged action | five attempts, then `RATE_LIMITED` |
| Cron endpoint with no secret, and with a wrong secret | 401 both |
| Report export by a role without `reports.export` | 404 |
| Report export columns for a role denied `employees.salary.view` | salary and IBAN absent from screen **and** file |
| File download: anonymous / no `documents.download` / wrong company | 401 / 404 / 404 |

Every fixture created during the test was removed.

## 12. Phase 13b — re-review of the modules built after Phase 13

Completed 2026-08-13. Phase 13 was run against the codebase at commit `8d0bc8d`.
Roughly twenty-six modules were built **after** that point — petty cash, increments,
appraisals, timesheets, job offers, servers, network, IP phones, CCTV, software
licences, AD accounts, documents hub, document types, checklist templates, audit
log UI, global search, org chart, vehicle handovers, and the rest — and none of
them existed when the checklist was ticked. A security review that only covers the
code that was present when it ran is a review of a smaller system than the one
being shipped, so the four checklist items that scale with surface area (1, 2, 4,
and the penetration self-test) were re-run against the new surface only.

### Findings

Two, both fixed. A third issue often grouped with these — `ExpirySource.SOFTWARE_LICENSE`
having no branch in `reconcileExpiryIndex`, which would have let the first nightly run
silently deactivate every software-licence expiry — was found and fixed while building
that module (commit `b7bb313`), not here. 13b only **verified** it, against the real cron
endpoint rather than a unit test: `reconciledDeactivated: 0`.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | **Privilege escalation in petty cash.** `createAccountAction` and `updateAccountAction` were gated on `pettycash.view` — a *read* permission that VIEWER holds. Any authenticated VIEWER could open an account, and, worse, edit an existing account's opening balance. The balance is derived as `opening + ledger` and never stored, so changing the opening figure silently rewrites every balance that account has ever displayed, with no transaction to explain the movement | **High** | Both actions moved to `pettycash.approve`. The page's "Open account" button is now rendered only when the actor holds it — an offered control that always fails is worse than no control. Re-forged from a VIEWER session: `FORBIDDEN`; SUPER_ADMIN control still succeeds, so the fix is not over-broad |
| 2 | **Ungated salary read.** `currentSalaryFor` in `services/hr-records.ts` checked company scope but not `employees.salary.view`. It had no caller at the time, so nothing leaked in the shipped build — but it is exactly the shape of function a future page calls without thinking | **Medium** (latent) | Now throws `ForbiddenError` unless the actor holds `employees.salary.view`, matching every other salary read |

### Checklist items re-run

| # | Item, restricted to the post-`8d0bc8d` surface | Result |
|---|---|---|
| 1 | Every new Server Action declares a permission | ✅ All go through `defineAction`; no new action bypasses the pipeline. A separate sweep pairs each action's `permission` with its audit verb and flags any write (`CREATE`/`UPDATE`/`DELETE`/`APPROVE`/`ASSIGN`/`RETURN`) gated on a `.view` permission — the shape of finding 1. **Zero remain** |
| 2 | Every new query is company-scoped | ✅ 23 candidates flagged by pattern and read one by one. Twenty-two were false positives — transitively scoped, explicit `companyId` comparison, or a deliberate global uniqueness check. The twenty-third was finding 2 |
| 4 | Every new schema is `.strict()` | ✅ 46 new schema objects, all strict by reading; 70 schemas then proven at runtime to reject an unknown key rather than drop it |
| — | Penetration self-test on the new surface | See below |

### Penetration self-test — new surface

Same method as Phase 13: Server Action ids harvested from the public JavaScript
bundles and fired with `curl` against a live instance, no UI involved.

| Attack | Result |
|---|---|
| **Control:** SUPER_ADMIN creates a document type | `success: true` — proves the harness reaches the action |
| VIEWER forging `createAccommodationAction` | `FORBIDDEN` |
| VIEWER forging `createAccountAction` (petty cash) | **`success: true` → finding 1** · after fix: `FORBIDDEN` |
| VIEWER forging `createLicenceAction` | `FORBIDDEN` |
| VIEWER forging `createDocumentTypeAction` | `FORBIDDEN` |
| HR forging `createLicenceAction` (IT module) | `FORBIDDEN` |
| IT_ADMIN forging `createIncrementAction` (HR module) | `FORBIDDEN` |
| IT_ADMIN forging `approveIncrementAction` | `FORBIDDEN` |
| Unknown-key injection into a new schema | `VALIDATION` |

Every fixture created during the test was removed: two petty cash accounts and one
document type, deleted after confirming none had dependent rows. The three audit
entries they generated were **kept** — the log is append-only, and a security test
that erases its own trail is testing the wrong property.

> **Method note.** The first run of this harness reported all-clear. It was wrong:
> the id-harvesting grep never matched, so every request went out with an empty
> `Next-Action` header and received page HTML — which contains neither `success`
> nor a `code`, and so read as "not exploited". The harness was rebuilt with a
> positive control (row 1) that must succeed for the run to mean anything. This is
> the fifth vacuous test caught in this project; a negative result is only evidence
> when a positive result was demonstrably reachable by the same path.
