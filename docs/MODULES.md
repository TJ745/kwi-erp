# MODULES

Module catalogue, dependency map, permission matrix, and navigation. **Proposed — pending approval.**

---

## 1. Module dependency map

Modules are grouped into layers. A module may only depend on layers below it. This ordering is what makes the phased roadmap in `DEVELOPMENT.md` buildable without rework.

```
┌── LAYER 4 — CROSS-CUTTING (consume everything) ─────────────────────┐
│  Dashboard · Reports · Global Search · Notifications · Audit Log    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌── LAYER 3 — DOMAIN MODULES ──┴──────────────────────────────────────┐
│  HR & Admin      IT               Fleet          Administration     │
│  ├ Contracts     ├ Helpdesk       ├ Vehicles     ├ Petty Cash       │
│  ├ Letters       ├ Assets         ├ Maintenance  ├ Accommodation    │
│  ├ Offers/JD     ├ Handover       └ Handover     ├ Suppliers        │
│  ├ Leave         ├ Infrastructure                ├ Subcontractors   │
│  ├ Timesheet     └ Password Vault ★              ├ Electricity      │
│  ├ Evaluation                                    └ Certificates     │
│  ├ Increments    Medical Insurance                                  │
│  ├ Warnings      Onboarding / Offboarding / Clearance               │
│  └ Correspondence                                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌── LAYER 2 — SHARED INFRASTRUCTURE ──────────────────────────────────┐
│  Employees · Documents/Files · Tasks · Checklist Engine ·           │
│  Expiry Engine · Letter Templates                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌── LAYER 1 — FOUNDATION ─────────────────────────────────────────────┐
│  Auth · RBAC · Companies · Departments · Positions · App Shell      │
└─────────────────────────────────────────────────────────────────────┘

★ Password Vault depends only on Layer 1 — deliberately isolated (see SECURITY.md).
```

### Critical dependency edges

| Module | Hard-depends on | Notes |
|---|---|---|
| Everything | Auth, RBAC, Company | Nothing renders without an actor context |
| Employees | Company, Department, Position | Blocks ~14 downstream modules |
| Documents | Employees, Company, FileObject | Polymorphic — any entity can own documents |
| Expiry Engine | Documents, Iqama, Contracts, Vehicles, Certificates, Insurance | Projection fed by all of them |
| Notifications | Expiry Engine, Tasks | Rules consume the projection |
| Dashboard | Nearly all modules | Built last within each phase, refined continuously |
| Onboarding/Offboarding | Checklist Engine, Employees, IT Assets, Accommodation | Offboarding reads outstanding assets/beds/tasks |
| Letters | Letter Templates, Employees, Company | Needs `dataSnapshot` source records |
| Vault | Auth, RBAC only | No employee/HR coupling by design |
| Reports | All domain modules | Read-only; last per phase |

**Build-order consequence:** Employees and Documents must be genuinely finished — not stubbed — before Phase 6 starts, or every HR module builds against a moving target.

---

## 2. Module catalogue

Each module ships with: list view (server-driven table), detail view, create/edit forms, delete or status transition, permissions, audit entries, and the four UI states.

### Layer 1 — Foundation

| Module | Route | Key capability |
|---|---|---|
| Authentication | `/login` | Better Auth email+password, Argon2id, session management, lockout |
| Users & Roles | `/settings/users`, `/settings/roles` | User CRUD, role assignment, per-user permission overrides, company access |
| Companies | `/settings/companies` | KWI/ICC + extensible; logo, registration, contacts, status |
| Departments & Positions | `/settings/departments` | Hierarchical departments, positions, department heads |
| App Shell | — | Sidebar, header, breadcrumbs, command menu (`⌘K`), theme, user menu |

### Layer 2 — Shared infrastructure

| Module | Route | Key capability |
|---|---|---|
| Employees | `/people/employees` | Master record + 18-tab profile (see §3) |
| Documents | `/documents` | Central document register, expiry tracking, versioning/renewal chain |
| Tasks & Follow-ups | `/tasks` | Polymorphic task attachment, board + list views, comments, overdue detection |
| Checklist Engine | `/settings/checklists` | Templates for onboarding, offboarding, clearance |
| Expiry Engine | — (service) | `ExpiryIndex` projection + nightly reconciliation |
| Letter Templates | `/settings/templates` | Variable-driven HTML templates |

### Layer 3 — Domain

**People operations**

| Module | Route |
|---|---|
| Onboarding | `/people/onboarding` |
| Offboarding | `/people/offboarding` (incl. clearance + return confirmation) |
| Leave | `/people/leave` |
| Timesheet & Delayed Hours | `/people/timesheet` |
| Organisation Chart | `/people/org-chart` |
| Iqama Management | `/people/iqama` — dedicated expiry-bucket view (7/15/30/60/90 days) |

**HR & Administration**

| Module | Route |
|---|---|
| Letters & Memos | `/hr/letters` |
| Contracts | `/hr/contracts` |
| Job Offers | `/hr/offers` |
| Job Descriptions | `/hr/job-descriptions` |
| Evaluations | `/hr/evaluations` |
| Increments | `/hr/increments` |
| Warning Letters | `/hr/warnings` |
| Correspondence | `/hr/correspondence` |
| Petty Cash | `/admin/petty-cash` |
| Accommodation | `/admin/accommodation` |
| Suppliers | `/admin/suppliers` |
| Subcontractors | `/admin/subcontractors` |
| Electricity Bills | `/admin/electricity-bills` |
| Company Certificates | `/admin/certificates` |

**IT**

| Module | Route |
|---|---|
| Helpdesk | `/it/helpdesk` |
| Assets & Handover | `/it/assets` |
| Servers | `/it/servers` |
| Active Directory | `/it/active-directory` |
| Network & IP | `/it/network` |
| IP Phones | `/it/ip-phones` |
| CCTV | `/it/cctv` |
| Software & Licences | `/it/software` |
| **Password Vault** | `/it/vault` — separate permissions, unlock gate, full access audit |

**Fleet / Insurance**

| Module | Route |
|---|---|
| Vehicles | `/vehicles` |
| Maintenance | `/vehicles/maintenance` |
| Handovers | `/vehicles/handovers` |
| Medical Insurance | `/insurance` |

### Layer 4 — Cross-cutting

| Module | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard` | KPI cards, today/overdue tasks, all alert feeds, quick actions |
| Reports | `/reports` | Employee/HR/IT/Fleet/Insurance/Admin reports with filters + export |
| Global Search | `⌘K` | Trigram search across 12 entity types, permission-filtered |
| Notifications | `/notifications` | Rule-driven, deduplicated, in-app first |
| Audit Log | `/audit` | Filterable by actor, entity, action, date |

---

## 3. Employee profile tabs

The 18 tabs from §8 of the brief map to modules as follows. Tabs are **lazy-loaded route segments** (`/people/employees/[id]/documents`), not one giant client component — each is a Server Component fetching only its own slice.

| Tab | Source | Permission |
|---|---|---|
| Overview | `Employee` | `employees.view` |
| Employment | `Employee`, `Department`, `Position` | `employees.view` |
| Documents | `Document` (entityType=EMPLOYEE) | `documents.view` |
| Iqama | `IqamaRecord`, `IqamaRenewal` | `employees.view` |
| Passport | `PassportRecord` | `employees.view` |
| Contracts | `Contract` | `hr.view` |
| Leave | `LeaveRequest` | `hr.view` |
| Timesheet | `TimesheetEntry` | `hr.view` |
| Evaluation | `Evaluation` | `hr.evaluations.view` |
| Warnings | `WarningLetter` | `hr.warnings.view` |
| Increment | `Increment` | `hr.increments.view` |
| IT Assets | `ITAssetAssignment` | `it.assets.view` |
| Accommodation | `BedAssignment` | `accommodation.view` |
| Onboarding | `ChecklistInstance` (ONBOARDING) | `hr.view` |
| Offboarding | `ChecklistInstance` (OFFBOARDING) | `hr.view` |
| Tasks | `Task` (entityType=EMPLOYEE) | `tasks.view` |
| Correspondence | `Correspondence` | `hr.view` |
| Audit History | `AuditLog` | `audit.view` |
| *(Bank details)* | `EmployeeBankDetail` | `employees.bank.view` — **separate, sensitive** |

Tabs the actor cannot see are not rendered at all — no empty tab, no "access denied" panel.

---

## 4. Permission catalogue

Format `module.resource.action`. Wildcards are **not** supported at check time; `SUPER_ADMIN` short-circuits instead.

```
# Core
dashboard.view
search.global

# Companies & org
companies.view          companies.manage        companies.viewAll
departments.view        departments.manage
positions.view          positions.manage

# Employees
employees.view          employees.create        employees.update
employees.delete        employees.export
employees.bank.view     employees.bank.manage       ← sensitive
employees.salary.view                               ← sensitive

# Documents
documents.view          documents.upload        documents.download
documents.delete        documents.manageTypes

# HR
hr.view                 hr.manage
hr.contracts.view       hr.contracts.manage
hr.leave.view           hr.leave.request        hr.leave.approve
hr.timesheet.view       hr.timesheet.manage     hr.timesheet.approve
hr.evaluations.view     hr.evaluations.manage
hr.increments.view      hr.increments.manage    hr.increments.approve
hr.warnings.view        hr.warnings.manage
hr.offers.view          hr.offers.manage
hr.correspondence.view  hr.correspondence.manage
hr.onboarding.view      hr.onboarding.manage
hr.offboarding.view     hr.offboarding.manage
hr.clearance.confirm

# Administration
pettycash.view          pettycash.create        pettycash.approve
accommodation.view      accommodation.manage
suppliers.view          suppliers.manage
subcontractors.view     subcontractors.manage
bills.view              bills.manage
certificates.view       certificates.manage

# IT
it.view                 it.manage
it.tickets.view         it.tickets.create       it.tickets.assign      it.tickets.resolve
it.assets.view          it.assets.manage        it.assets.assign
it.infrastructure.view  it.infrastructure.manage

# Vault — deliberately granular                    ← all sensitive
vault.view              vault.reveal            vault.create
vault.update            vault.delete            vault.export
vault.grant

# Fleet
vehicles.view           vehicles.manage         vehicles.assign
vehicles.maintenance.view   vehicles.maintenance.manage

# Insurance
insurance.view          insurance.manage

# Tasks
tasks.view              tasks.viewAll           tasks.create
tasks.update            tasks.delete            tasks.assign

# Letters
letters.view            letters.generate        letters.manageTemplates

# Platform
reports.view            reports.export
notifications.view      notifications.manageRules
audit.view              audit.export                ← sensitive
users.view              users.manage                ← sensitive
roles.manage                                        ← sensitive
settings.manage                                     ← sensitive
```

### Role → permission mapping (seed defaults)

| Role | Grant |
|---|---|
| `SUPER_ADMIN` | Everything, including `vault.*`, `roles.manage`, `audit.export` |
| `ADMIN` | All except `vault.*` (beyond none), `roles.manage`, `users.manage`; full HR/Admin/Fleet/Insurance/Reports |
| `HR` | `employees.*` (incl. `bank.view`, `salary.view`), `hr.*`, `documents.*`, `letters.*`, onboarding/offboarding, `tasks.*`, `reports.view/export`. **No IT, no vault, no vehicles.manage** |
| `IT_ADMIN` | `it.*`, `it.assets.*`, `it.infrastructure.*`, `vault.view/reveal/create/update` (**not** `delete`/`export`/`grant`), `employees.view`, `tasks.*`, `reports.view` |
| `MANAGER` | `employees.view` (own department), `hr.leave.approve`, `hr.timesheet.approve`, `hr.evaluations.manage`, `tasks.*`, `dashboard.view`, `reports.view` |
| `USER` | `dashboard.view`, own profile, `hr.leave.request`, `it.tickets.create`, `tasks.view/create/update` (own) |
| `VIEWER` | `*.view` on non-sensitive modules only. No create/update/delete, no vault, no bank, no salary, no audit |

**Two rules encoded in the seed, per §27 of the brief:**
1. `HR` and `ADMIN` receive **zero** `vault.*` permissions. Granting them requires an explicit, audited `roles.manage` action.
2. `employees.bank.view` and `employees.salary.view` are separate from `employees.view`, so a `VIEWER` browsing the employee directory never sees IBANs or salaries.

### Data-scope rules layered on top of permissions

Permissions answer *"may this action happen?"*; scope answers *"to which rows?"*.

| Scope | Applied to |
|---|---|
| **Company scope** | Every query on company-owned tables, from `UserCompanyAccess`; bypassed only by `companies.viewAll` |
| **Own-record scope** | `USER` sees only own leave, timesheet, tickets, assets, profile |
| **Department scope** | `MANAGER` limited to their department subtree via `Department.parentId` recursion |
| **Assignment scope** | `tasks.view` shows assigned + created; `tasks.viewAll` widens it |

---

## 5. Navigation

Approved structure, with three deviations from §54 of the brief, each justified:

```
Dashboard

People
  Employees
  Iqama & Passports          ← NEW: §11 demands a dedicated expiry workspace
  Onboarding
  Offboarding                 ← includes Clearance + Return Confirmation
  Leave
  Timesheet
  Organisation Chart

HR & Admin
  Letters & Memos             ← merged: same generator, same table
  Contracts
  Job Offers
  Job Descriptions
  Evaluations
  Increments
  Warning Letters
  Correspondence              ← NEW in nav: §12 is a core proof-of-action feature
  Petty Cash
  Accommodation
  Suppliers
  Subcontractors
  Electricity Bills
  Company Certificates

Documents
Tasks & Follow-ups

IT
  Helpdesk
  Assets
  Servers
  Active Directory
  Network & IP
  IP Phones
  CCTV
  Software & Licences
  Password Vault              ← visually separated, lock icon, own permission gate

Vehicles
  Vehicles
  Maintenance
  Handovers

Medical Insurance
Reports
Notifications
Audit Logs
Settings
  General · Companies · Departments · Users · Roles & Permissions
  Document Types · Checklist Templates · Letter Templates · Notification Rules
```

**Deviations explained**

1. **Clearance folded into Offboarding.** The brief lists Clearance under HR & Admin, but a clearance form only ever exists as part of an offboarding. Keeping it as a separate nav item would produce an orphaned list that HR would have to cross-reference by hand.
2. **Letters and Memos merged.** They share a template engine, a table, and a permission. Two nav entries pointing at one filtered list is noise.
3. **Iqama & Passports promoted.** §11 asks for expiry buckets at 7/15/30/60/90 days — that is a daily workspace for the administrator, not a tab buried in each employee record.

Navigation items render only when the actor holds the module's `.view` permission. An empty section header never renders.

---

## 6. Shared component contracts

Built once in Phase 4, consumed everywhere. Duplicating any of these is a review failure.

| Component | Contract |
|---|---|
| `DataTable` | Server-driven; takes `columns`, `data`, `pageCount`, `searchParams`. Owns sort/filter/pagination/column-visibility/export/row-actions |
| `PageHeader` | Title, description, breadcrumb, primary action slot |
| `FilterBar` | Declarative filter defs → URL search params |
| `StatusBadge` | One status→colour map for the whole app; never inline `bg-green-100` |
| `ExpiryAlert` | Consumes `lib/expiry.ts`; renders consistent expiry chips everywhere |
| `ConfirmDialog` / `DeleteDialog` | Typed-confirmation for destructive actions |
| `FileUpload` | Client-side MIME/size pre-check + server validation; progress; multi-file |
| `DocumentViewer` | PDF/image preview via the authorised `/api/files/[id]` proxy |
| `EntitySelect` | Async, paginated, permission-filtered combobox |
| `EmployeeSelect` / `CompanySelect` | Thin wrappers over `EntitySelect` |
| `DatePicker` / `DateRangePicker` | date-fns backed, consistent parsing, timezone-safe |
| `EmptyState` / `LoadingState` / `ErrorState` | Every list and tab uses these — no ad-hoc "No data" strings |
| `AuditTimeline` | Renders `AuditLog` with field-level diffs |
| `TaskCard` | Board + list rendering |
| `FormField` | RHF + Zod wiring, label/description/error, a11y ids |

### Responsive behaviour (§42)

Tables do not shrink — they **transform**. At `< md`, `DataTable` switches to a card list driven by a `mobileRender` column config, showing 3–4 primary fields plus a row-action menu. The sidebar collapses to a sheet; the command menu becomes the primary navigation on mobile.

---

## 7. Cross-module business rules

Rules that span modules, owned by services rather than any single screen:

| Rule | Enforced where |
|---|---|
| Asset cannot be assigned twice concurrently | Partial unique index + `assetService.assign()` |
| Vehicle has one active driver | Partial unique index + `vehicleService.assignDriver()` |
| Bed holds one occupant | Partial unique index + `accommodationService.assign()` |
| Employee cannot be hard-deleted | Service rejects; status transitions only |
| Offboarding blocks completion while assets are unreturned | `checklistService.complete()` queries open `ITAssetAssignment`, `BedAssignment`, open `Task` |
| Rejected leave can never display as approved | Status is a single enum on one row; transitions validated by a state machine |
| Expired items always surface in reports | Reports read `ExpiryIndex`, never a cached status |
| Task overdue is derived | `dueDate < now() AND status NOT IN (COMPLETED, CANCELLED)` |
| Credentials never appear in HR/employee APIs | Vault services live in a separate module; no other service imports `server/crypto` |
| Generated letters freeze their data | `GeneratedLetter.dataSnapshot` + `renderedHtml`; the letter is never re-rendered from live data |
| A letter cannot be used to bypass salary permissions | `GeneratedLetter.containsSalary`, set at generation from what actually rendered; `getGeneratedLetter` filters on it unless the actor holds `employees.salary.view` |
| A template cannot execute anything | Placeholders resolve from a fixed allowlist; bodies are sanitised against a tag/attribute/style allowlist on save and again on render |
| Contract/Iqama renewal supersedes rather than overwrites | `Document.supersedesId` chain + `ExpiryIndex.isActive=false` on the old row |
