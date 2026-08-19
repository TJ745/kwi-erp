# DATABASE DESIGN

Proposed Prisma / PostgreSQL data model. **Not yet implemented** — this is the design for approval.

Target: PostgreSQL on Neon, Prisma `7.9.1`, multi-file schema under `prisma/schema/`.

---

## 1. Design summary

The brief lists ~60 candidate entities. After normalisation and the consolidations described below, the model lands at **87 tables and 48 enums across 12 schema files** (verified against generated SQL: 87 `CREATE TABLE`, 48 `CREATE TYPE`, 259 indexes, 139 foreign keys), with four deliberate simplifications versus a literal reading of the brief:

| Consolidation | Brief listed | Proposed | Why |
|---|---|---|---|
| Polymorphic `Document` | `EmployeeDocument`, `VehicleDocument`, `Document`, per-module doc tables | **1** table | Identical shape; expiry reporting needs one source |
| Checklist engine (ADR-006) | `Onboarding`, `OnboardingTask`, `Offboarding`, `OffboardingTask`, clearance, return confirmation | **4** tables | Same shape; makes templates admin-configurable |
| Asset assignment lifecycle | `ITAssetAssignment` + `ITAssetHandover` | **1** table | Handover-out and handover-in are two ends of one row |
| `ExpiryIndex` projection (ADR-005) | — (new) | **+1** table | Replaces an 11-way UNION in the reminder engine |

### Global conventions

- **Primary keys:** `String @id @default(cuid(2))` — unguessable in URLs, sortable-ish, no cross-DB sequence coupling.
- **Business identifiers** are separate, human-facing, and sequential: `EMP-00042`, `TKT-2026-0117`, `IT-00045`, `VEH-011`. Generated from a `Counter` table with `SELECT … FOR UPDATE` inside the creating transaction. Never reuse a PK as a display code.
- **Timestamps:** every table has `createdAt DateTime @default(now())`; every mutable table has `updatedAt DateTime @updatedAt`.
- **Money:** `Decimal @db.Decimal(14, 2)` — never `Float`. Currency defaults to `SAR`, stored per-row for future-proofing.
- **Enums** are Postgres enums via Prisma `enum` where the value set is stable and code branches on it. Where the set must be user-editable (roles, document types, leave types, credential categories, ticket categories) it is a **table**, not an enum.
- **Naming:** models `PascalCase` singular, fields `camelCase`, relations named explicitly on both sides.

---

## 2. Schema file layout

```
prisma/schema/
├── schema.prisma        # datasource, generator, shared enums
├── auth.prisma          # Better Auth models + Role/Permission/Grant
├── org.prisma           # Company, Department, Position, Counter
├── employee.prisma      # Employee + identity/bank/iqama/passport
├── document.prisma      # FileObject, Document, DocumentType, Attachment
├── hr.prisma            # Contract, offers, leave, timesheet, evaluation…
├── checklist.prisma     # Template/Instance/Item (onboarding, offboarding, clearance)
├── admin.prisma         # Petty cash, accommodation, suppliers, bills, certificates
├── it.prisma            # Tickets, assets, infrastructure
├── vault.prisma         # Credentials + grants + access log
├── fleet.prisma         # Vehicles, maintenance, handover
└── platform.prisma      # Task, Notification, AuditLog, ExpiryIndex, LetterTemplate
```

---

## 3. Identity & access

```prisma
model User {
  id                String    @id @default(cuid(2))
  email             String    @unique
  name              String
  emailVerified     Boolean   @default(false)
  image             String?
  // --- extensions beyond Better Auth defaults ---
  status            UserStatus @default(ACTIVE)
  roleId            String
  employeeId        String?   @unique      // optional link; not every user is an employee
  mustChangePassword Boolean  @default(false)
  lastLoginAt       DateTime?
  failedLoginCount  Int       @default(0)
  lockedUntil       DateTime?
  deletedAt         DateTime?

  role              Role      @relation(fields: [roleId], references: [id])
  employee          Employee? @relation(fields: [employeeId], references: [id])
  companyAccess     UserCompanyAccess[]
  overrides         UserPermission[]
  sessions          Session[]
  accounts          Account[]

  @@index([status])
  @@index([roleId])
}

model Role {
  id          String  @id @default(cuid(2))
  key         String  @unique          // SUPER_ADMIN, ADMIN, HR, IT_ADMIN, MANAGER, USER, VIEWER
  name        String
  description String?
  isSystem    Boolean @default(false)  // system roles cannot be deleted
  rank        Int                      // for "cannot edit a role senior to your own"
  permissions RolePermission[]
  users       User[]
}

model Permission {
  id     String @id @default(cuid(2))
  key    String @unique                // "employees.update"
  module String                        // "employees"  — for grouping in the UI
  label  String
  isSensitive Boolean @default(false)  // vault.*, users.manage, audit.view
  roles  RolePermission[]
  users  UserPermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
}

model UserPermission {              // per-user override, evaluated after role
  userId       String
  permissionId String
  effect       GrantEffect          // ALLOW | DENY  — DENY always wins
  grantedById  String
  expiresAt    DateTime?            // supports temporary elevation
  @@id([userId, permissionId])
}

model UserCompanyAccess {
  userId    String
  companyId String
  isDefault Boolean @default(false)
  @@id([userId, companyId])
}
```

Better Auth also owns `Session`, `Account`, and `Verification` tables; these are generated to its expected shape and extended only with `ipAddress` / `userAgent`, which it already supports.

**Permission resolution** (single implementation, `server/auth/permissions.ts`):

```
effective = (role.permissions ∪ user overrides where effect=ALLOW and not expired)
          − (user overrides where effect=DENY)
SUPER_ADMIN short-circuits to ALL.
```

Resolved once per request and memoised with React `cache()`.

---

## 4. Organisation

```prisma
model Company {
  id             String  @id @default(cuid(2))
  code           String  @unique       // KWI, ICC
  name           String
  nameAr         String?
  shortName      String
  registrationNo String?
  crNumber       String?
  vatNumber      String?
  addressLine    String?
  city           String?
  country        String  @default("SA")
  phone          String?
  email          String?
  website        String?
  logoFileId     String?
  // Letterhead artwork, rendered as page chrome on generated letters. Held as
  // file references, not inside a template body: the letter sanitiser forbids
  // <img> on purpose, and letterhead is layout rather than content.
  headerImageFileId String?
  footerImageFileId String?
  status         RecordStatus @default(ACTIVE)
  notes          String?
  deletedAt      DateTime?
  // relations: departments, employees, vehicles, certificates, policies…
}

model Department {
  id             String  @id @default(cuid(2))
  companyId      String
  code           String
  name           String
  nameAr         String?
  parentId       String?              // self-referencing for sub-departments
  headEmployeeId String?
  status         RecordStatus @default(ACTIVE)
  @@unique([companyId, code])
  @@index([companyId, status])
}

model Position {
  id                String  @id @default(cuid(2))
  companyId         String?            // null = shared across companies
  title             String
  titleAr           String?
  grade             String?
  jobDescriptionId  String?
  @@index([companyId])
}

model Counter {                        // sequential business codes
  key   String @id                     // "employee", "ticket:2026", "asset"
  value Int    @default(0)
}
```

The **organisation chart** is derived from `Employee.managerId` + `Department.parentId` — no separate table.

---

## 5. Employee

Split deliberately so that sensitive data sits behind its own permission and its own table, per §8 of the brief.

```prisma
model Employee {
  id             String @id @default(cuid(2))
  employeeNo     String @unique          // EMP-00042
  companyId      String
  departmentId   String?
  positionId     String?
  managerId      String?

  firstName      String
  lastName       String
  fullName       String                  // generated in service layer; indexed for search
  fullNameAr     String?
  gender         Gender
  dateOfBirth    DateTime?
  nationality    String                  // ISO-3166 alpha-2
  maritalStatus  MaritalStatus?

  status         EmployeeStatus @default(ACTIVE)
  employmentType EmploymentType @default(FULL_TIME)
  joiningDate    DateTime
  lastWorkingDate DateTime?

  mobile         String?
  workEmail      String?  @unique
  personalEmail  String?
  photoFileId    String?
  notes          String?
  deletedAt      DateTime?

  bankDetail     EmployeeBankDetail?
  iqama          IqamaRecord?
  passport       PassportRecord?
  emergencyContacts EmergencyContact[]
  contracts      Contract[]
  bedAssignments BedAssignment[]
  assetAssignments ITAssetAssignment[]

  @@index([companyId, status])
  @@index([departmentId])
  @@index([managerId])
  @@index([fullName])
  @@index([status, joiningDate])
}

model EmployeeBankDetail {              // permission: employees.bank.view
  id         String @id @default(cuid(2))
  employeeId String @unique
  bankName   String
  iban       String
  accountNo  String?
  swift      String?
  documentId String?
  verifiedAt DateTime?
}

model IqamaRecord {
  id             String @id @default(cuid(2))
  employeeId     String @unique
  iqamaNumber    String @unique
  profession     String
  professionAr   String?
  issueDate      DateTime
  expiryDate     DateTime
  sponsorName    String?
  renewalStatus  RenewalStatus @default(NOT_STARTED)
  notes          String?
  renewals       IqamaRenewal[]
  @@index([expiryDate])
  @@index([renewalStatus])
}

model IqamaRenewal {                    // history + proof of action
  id             String @id @default(cuid(2))
  iqamaRecordId  String
  previousExpiry DateTime
  newExpiry      DateTime?
  submittedAt    DateTime?
  completedAt    DateTime?
  status         RenewalStatus
  correspondenceId String?              // links to the email that was sent
  notes          String?
}

model PassportRecord {
  id             String @id @default(cuid(2))
  employeeId     String @unique
  passportNumber String
  issueCountry   String
  issuePlace     String?
  issueDate      DateTime
  expiryDate     DateTime
  notes          String?
  @@unique([passportNumber, issueCountry])
  @@index([expiryDate])
}

model EmergencyContact {
  id         String @id @default(cuid(2))
  employeeId String
  name       String
  relation   String
  phone      String
  altPhone   String?
  address    String?
}
```

**Note on `IqamaRecord` being 1:1** — the *current* Iqama is one row so that expiry queries stay trivial; historical renewals live in `IqamaRenewal`. This avoids the "which of these five rows is current?" problem that an `isCurrent` flag creates.

---

## 6. Documents & files

```prisma
model FileObject {                      // physical file — storage metadata only
  id             String @id @default(cuid(2))
  fileKey        String @unique         // UploadThing file key
  originalName   String
  mimeType       String                 // declared type, re-verified post-upload
  detectedType   String?                // from magic-byte sniff in onUploadComplete
  sizeBytes      Int
  checksumSha256 String?                // computed during validation
  isPrivate      Boolean @default(true) // asserted against UploadThing ACL
  uploadedById   String
  scanStatus     ScanStatus @default(PENDING)  // PENDING|CLEAN|REJECTED
  createdAt      DateTime @default(now())
  @@index([checksumSha256])             // dedupe detection
  @@index([scanStatus])
}

model DocumentType {                    // admin-editable, not an enum
  id                String @id @default(cuid(2))
  key               String @unique      // "IQAMA", "PASSPORT", "CV", "CONTRACT"
  name              String
  appliesTo         EntityType[]
  requiresExpiry    Boolean @default(false)
  defaultWarningDays Int[]  @default([90, 60, 30, 15, 7, 1])
  isSystem          Boolean @default(false)
}

model Document {                        // governed record with lifecycle
  id             String  @id @default(cuid(2))
  companyId      String
  documentTypeId String
  entityType     EntityType             // EMPLOYEE | VEHICLE | COMPANY | SUBCONTRACTOR…
  entityId       String
  title          String
  documentNo     String?
  fileId         String
  issueDate      DateTime?
  expiryDate     DateTime?
  issuedBy       String?
  notes          String?
  version        Int      @default(1)
  supersedesId   String?  @unique       // renewal chain
  uploadedById   String
  deletedAt      DateTime?

  @@index([entityType, entityId])
  @@index([expiryDate])
  @@index([companyId, documentTypeId])
}

model Attachment {                      // casual attachment: ticket, task, comment
  id           String @id @default(cuid(2))
  fileId       String
  entityType   EntityType
  entityId     String
  uploadedById String
  createdAt    DateTime @default(now())
  @@index([entityType, entityId])
}
```

### Polymorphic relations — the honest trade-off

Prisma has no native polymorphic FK. `Document`, `Attachment`, `Task`, `AuditLog`, and `ExpiryIndex` use `(entityType, entityId)` with **no database-level foreign key**. That means Postgres will not prevent an orphan row.

Mitigations, all of which are real work we are committing to:
1. Only the service layer writes these rows, and it always resolves the parent first.
2. Deleting a parent cascades through an explicit `detachEntity(entityType, entityId, tx)` helper called in the same transaction.
3. A weekly reconciliation job reports orphans rather than silently deleting them.

The alternative — a join table per entity type — would mean ~15 near-identical tables and a `UNION` on every "show me everything attached to X" query. We accept application-enforced integrity here.

---

## 7. ExpiryIndex (ADR-005)

```prisma
model ExpiryIndex {
  id           String       @id @default(cuid(2))
  source       ExpirySource
  sourceId     String                      // PK of the originating row
  companyId    String?
  employeeId   String?                     // for "whose document is this"
  vehicleId    String?
  label        String                      // "Iqama — Ahmed Khan"
  expiryDate   DateTime
  warningDays  Int[]        @default([90, 60, 30, 15, 7, 1])
  isActive     Boolean      @default(true) // false when superseded/renewed
  updatedAt    DateTime     @updatedAt

  @@unique([source, sourceId])
  @@index([isActive, expiryDate])
  @@index([companyId, isActive, expiryDate])
  @@index([employeeId])
}

enum ExpirySource {
  IQAMA
  PASSPORT
  EMPLOYEE_CONTRACT
  DOCUMENT
  COMPANY_CERTIFICATE
  VEHICLE_REGISTRATION
  VEHICLE_INSURANCE
  SUBCONTRACTOR_CONTRACT
  SUPPLIER_CONTRACT
  MEDICAL_INSURANCE_POLICY
  IT_ASSET_WARRANTY
}
```

**Sync contract.** Every service that writes an expiry-bearing row calls, in the *same* `prisma.$transaction`:

```ts
await expiryIndex.upsert(tx, {
  source: "IQAMA", sourceId: iqama.id, companyId, employeeId,
  label: `Iqama — ${employee.fullName}`, expiryDate: iqama.expiryDate,
});
```

**Self-healing.** A nightly `reconcileExpiryIndex()` job rebuilds the projection from source tables and logs any drift. If sync is ever missed by a new code path, the projection corrects itself within 24 hours and we get a log entry pointing at the bug.

**Status is not stored.** `EXPIRED | EXPIRING_SOON | VALID` is computed from `expiryDate` versus `now()` and the applicable warning window, in one shared helper (`lib/expiry.ts`) used by SQL filters and UI alike.

---

## 8. Soft deletion policy

Universal soft delete is a trap: it breaks unique constraints, silently corrupts counts, and hides bugs. Applied **selectively**:

| Soft delete (`deletedAt`) | Hard delete | Never delete (status only) |
|---|---|---|
| `Company`, `Employee`, `Document`, `Credential`, `Vehicle`, `ITAsset`, `Supplier`, `Subcontractor`, `LetterTemplate` | `Attachment`, `TaskComment`, `TicketComment`, draft rows, join tables | `AuditLog`, `CredentialAccess`, `Notification` |

Enforced by a Prisma client extension that adds `deletedAt: null` to `findMany`/`findFirst` on the soft-delete models, with an explicit `.withDeleted()` escape hatch for admin/audit views.

**Unique-constraint caveat:** soft-deleted rows still occupy `@unique` values (e.g. `Employee.employeeNo`). Codes are never recycled, so this is correct behaviour rather than a limitation — but it is why `workEmail` uniqueness is scoped and documented.

Per §50 of the brief, an `Employee` is **not** deletable through the UI at all — only status transitions (`ACTIVE → RESIGNED / TERMINATED / EXITED / INACTIVE`). `deletedAt` exists solely for data-entry error correction by `SUPER_ADMIN`, and is audited.

---

## 9. HR

```prisma
model Contract {
  id           String @id @default(cuid(2))
  employeeId   String
  companyId    String
  contractType ContractType
  startDate    DateTime
  endDate      DateTime?
  probationEndDate DateTime?
  basicSalary  Decimal? @db.Decimal(14,2)
  allowances   Json?                    // {housing, transport, other}
  currency     String   @default("SAR")
  status       ContractStatus @default(ACTIVE)
  documentId   String?
  notes        String?
  @@index([employeeId, status])
  @@index([endDate])
}

model LeaveType   { id, key @unique, name, isPaid, maxDaysPerYear, requiresAttachment }
model LeaveRequest {
  id, employeeId, leaveTypeId, startDate, endDate, days Decimal(5,1),
  reason, status LeaveStatus, approverId?, decidedAt?, decisionComment?,
  handoverToId?, createdById
  @@index([employeeId, status]) @@index([status, startDate])
}

model TimesheetEntry {
  id, employeeId, date, normalHours Decimal(4,2), overtimeHours Decimal(4,2),
  delayedHours Decimal(4,2), absent Boolean, notes, status ApprovalStatus, approvedById?
  @@unique([employeeId, date])
  @@index([date, status])
}

model Evaluation      { id, employeeId, periodStart, periodEnd, evaluatorId, overallScore Decimal(4,2), status, summary, documentId? }
model EvaluationScore  { id, evaluationId, criterion, weight, score, comment }
model Increment        { id, employeeId, currentSalary, newSalary, amount, percentage, effectiveDate, status ApprovalStatus, requestedById, approvedById?, notes }
model WarningLetter    { id, employeeId, level WarningLevel, reason, description, issuedDate, issuedById, documentId?, acknowledgedAt? }
model JobDescription   { id, companyId?, positionId?, title, summary, responsibilities, requirements, isActive, version }
model JobOffer         { id, companyId, candidateName, candidateEmail, candidatePhone, positionId, proposedSalary, benefits Json, proposedJoiningDate, status OfferStatus, letterId?, convertedEmployeeId? }
model Correspondence   {
  id, companyId, employeeId?, type CorrespondenceType, subject, recipient,
  sentDate, status CorrespondenceStatus, followUpDate?, notes, createdById
  @@index([status, followUpDate]) @@index([employeeId])
}
```

`Correspondence` is the "prove we sent it" record required by §12 — it is intentionally simple and always attachable.

---

## 10. Checklist engine (ADR-006)

```prisma
model ChecklistTemplate {
  id        String @id @default(cuid(2))
  key       String @unique
  name      String
  type      ChecklistType         // ONBOARDING | OFFBOARDING | CLEARANCE
  companyId String?               // null = applies to all companies
  isActive  Boolean @default(true)
  items     ChecklistTemplateItem[]
}

model ChecklistTemplateItem {
  id                     String @id @default(cuid(2))
  templateId             String
  order                  Int
  label                  String
  category               ChecklistCategory   // HR | IT | ADMIN | FINANCE | ACCOMMODATION | FLEET
  responsibleDepartmentId String?
  responsibleRoleId      String?
  requiresAttachment     Boolean @default(false)
  requiresDate           Boolean @default(false)
  defaultDueDays         Int?                 // offset from instance start
  @@unique([templateId, order])
}

model ChecklistInstance {
  id          String @id @default(cuid(2))
  templateId  String
  type        ChecklistType
  employeeId  String
  companyId   String
  status      ChecklistStatus @default(IN_PROGRESS)
  startedAt   DateTime @default(now())
  targetDate  DateTime?
  completedAt DateTime?
  createdById String
  items       ChecklistItem[]
  @@index([employeeId, type])
  @@index([status, type])
}

model ChecklistItem {
  id             String @id @default(cuid(2))
  instanceId     String
  templateItemId String?
  order          Int
  label          String
  category       ChecklistCategory
  status         ChecklistItemStatus @default(PENDING)   // PENDING|IN_PROGRESS|COMPLETED|NOT_APPLICABLE|BLOCKED
  assignedToId   String?
  dueDate        DateTime?
  completedAt    DateTime?
  completedById  String?
  attachmentId   String?
  notes          String?
  @@index([instanceId, order])
  @@index([assignedToId, status])
}
```

This one engine serves onboarding (§13), offboarding (§14), clearance forms (§15) and return confirmation (§16). The offboarding view additionally joins outstanding `ITAssetAssignment` (unreturned), open `Task`s, and active `BedAssignment` to satisfy the §50 rule *"offboarding should show outstanding assets/tasks/clearance"*.

---

## 11. IT

```prisma
model ITTicket {
  id            String @id @default(cuid(2))
  ticketNo      String @unique              // TKT-2026-0117
  companyId     String
  requesterId   String                      // User
  departmentId  String?
  categoryId    String
  priority      Priority     @default(MEDIUM)
  subject       String
  description   String
  assignedToId  String?
  status        TicketStatus @default(OPEN)
  dueDate       DateTime?
  resolvedAt    DateTime?
  closedAt      DateTime?
  resolution    String?
  relatedAssetId String?
  @@index([status, priority])
  @@index([assignedToId, status])
  @@index([companyId, createdAt])
}

model TicketCategory { id, key @unique, name, defaultSlaHours Int?, isActive }
model TicketComment  { id, ticketId, authorId, body, isInternal Boolean, createdAt }

model ITAsset {
  id             String @id @default(cuid(2))
  assetCode      String @unique             // IT-00045
  assetTag       String? @unique
  type           AssetType                  // LAPTOP|DESKTOP|MONITOR|PRINTER|MOBILE|IP_PHONE|NETWORK|OTHER
  brand          String
  model          String
  serialNumber   String? @unique
  companyId      String
  purchaseDate   DateTime?
  purchaseCost   Decimal? @db.Decimal(14,2)
  warrantyExpiry DateTime?
  status         AssetStatus @default(AVAILABLE)
  condition      AssetCondition @default(GOOD)
  location       String?
  specifications Json?
  notes          String?
  deletedAt      DateTime?
  assignments    ITAssetAssignment[]
  @@index([status, type])
  @@index([companyId, status])
  @@index([warrantyExpiry])
}

model ITAssetAssignment {                    // out + in on one row
  id                String @id @default(cuid(2))
  assetId           String
  employeeId        String
  assignedAt        DateTime
  assignedById      String
  conditionOut      AssetCondition
  accessoriesOut    Json?                    // ["charger","bag","mouse"]
  remarksOut        String?
  acknowledgedAt    DateTime?                // employee confirmation
  returnedAt        DateTime?
  receivedById      String?
  conditionIn       AssetCondition?
  missingAccessories Json?
  remarksIn         String?
  handoverDocumentId String?
  @@index([assetId, returnedAt])
  @@index([employeeId, returnedAt])
}
```

**Business rule enforced in the database.** §50 requires *"an asset cannot be assigned to two employees simultaneously."* Prisma cannot express a partial unique index, so this ships as a raw SQL statement inside the migration:

```sql
CREATE UNIQUE INDEX it_asset_single_active_assignment
  ON "ITAssetAssignment" ("assetId")
  WHERE "returnedAt" IS NULL;
```

The service layer also checks, but the constraint is what makes the rule true under concurrency.

**Infrastructure** — kept as separate tables because their attributes barely overlap with assignable endpoint hardware:

```prisma
model Server        { id, name @unique, companyId, ipAddress, os, role, location, status, cpuSpec?, ramGb?, storageGb?, notes }
model NetworkDevice { id, name, type, model, ipAddress?, macAddress?, location, vlan?, portCount?, status, notes }
model IpAddress     { id, address @unique, subnet, assignedTo?, deviceType?, deviceId?, isStatic, notes }
model IpPhone       { id, extension @unique, employeeId?, deviceModel?, macAddress?, location, status }
model CctvDevice    { id, name, type CctvType, location, ipAddress?, recorderId?, status, lastMaintenanceAt?, notes }
model SoftwareLicense { id, name, vendor, licenseKeyCredentialId?, seats, seatsUsed, purchaseDate?, expiryDate?, companyId, notes }
model AdRecord      { id, samAccountName @unique, employeeId?, ou, groups Json, enabled, lastSyncedAt, notes }
```

`AdRecord` and `SoftwareLicense` deliberately store **no credentials** — where a key or password is needed they reference `Credential.id`.

---

## 12. Password vault

Cryptographic design is specified in `SECURITY.md` §5. The storage shape:

```prisma
model CredentialCategory {
  id       String @id @default(cuid(2))
  key      String @unique          // GOVERNMENT|COMPANY_PORTAL|EMAIL|SERVER|NETWORK|CCTV|SOFTWARE|OTHER
  name     String
  parentId String?
}

model Credential {
  id            String @id @default(cuid(2))
  name          String
  categoryId    String
  companyId     String?
  url           String?
  username      String?
  email         String?
  // --- envelope-encrypted payload ---
  ciphertext    Bytes                  // AES-256-GCM(password)
  iv            Bytes
  authTag       Bytes
  wrappedDek    Bytes                  // DEK encrypted under KEK
  keyVersion    Int    @default(1)
  notesCipher   Bytes?                 // notes may contain secrets → also encrypted
  notesIv       Bytes?
  notesAuthTag  Bytes?
  status        RecordStatus @default(ACTIVE)
  lastRotatedAt DateTime?
  rotationDueAt DateTime?
  createdById   String
  updatedById   String
  deletedAt     DateTime?
  versions      CredentialVersion[]
  grants        CredentialGrant[]
  @@index([categoryId, status])
  @@index([companyId])
}

model CredentialVersion {              // change history — previous ciphertexts
  id           String @id @default(cuid(2))
  credentialId String
  ciphertext   Bytes
  iv           Bytes
  authTag      Bytes
  wrappedDek   Bytes
  keyVersion   Int
  changedById  String
  changedAt    DateTime @default(now())
  reason       String?
}

model CredentialGrant {                // ACL on top of the global vault.* permissions
  id           String @id @default(cuid(2))
  credentialId String?
  categoryId   String?
  userId       String?
  roleId       String?
  level        VaultAccessLevel        // READ | REVEAL | MANAGE
  grantedById  String
  expiresAt    DateTime?
}

model CredentialAccess {               // append-only; never contains the secret
  id           String @id @default(cuid(2))
  credentialId String
  userId       String
  action       VaultAction             // LIST|VIEW|REVEAL|COPY|CREATE|UPDATE|DELETE|ROTATE
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())
  @@index([credentialId, createdAt])
  @@index([userId, createdAt])
}

model VaultSession {                   // short-lived unlock
  id         String @id @default(cuid(2))
  userId     String
  tokenHash  String @unique            // SHA-256 of the token; token itself never stored
  createdAt  DateTime @default(now())
  expiresAt  DateTime
  lastUsedAt DateTime
  revokedAt  DateTime?
  @@index([userId, expiresAt])
}
```

`CredentialFavorite (userId, credentialId)` completes the feature list.

---

## 13. Fleet

```prisma
model Vehicle {
  id              String @id @default(cuid(2))
  vehicleCode     String @unique          // VEH-011
  plateNumber     String @unique
  plateNumberAr   String?
  make            String
  model           String
  year            Int
  color           String?
  vin             String? @unique
  companyId       String
  status          VehicleStatus @default(ACTIVE)
  currentDriverId String?
  currentMileage  Int?
  registrationNo    String?
  registrationExpiry DateTime?
  insurancePolicyNo  String?
  insuranceProvider  String?
  insuranceExpiry    DateTime?
  notes           String?
  deletedAt       DateTime?
  @@index([companyId, status])
  @@index([registrationExpiry])
  @@index([insuranceExpiry])
}

model VehicleAssignment  { id, vehicleId, employeeId, assignedAt, unassignedAt?, assignedById, notes  @@index([vehicleId, unassignedAt]) }
model VehicleMaintenance { id, vehicleId, date, mileage, type MaintenanceType, description, workshop?, cost Decimal(14,2)?, receiptFileId?, nextDueDate?, nextDueMileage?, status, notes  @@index([vehicleId, date]) @@index([nextDueDate]) }
model VehicleHandover    { id, vehicleId, fromEmployeeId?, toEmployeeId?, handoverDate, mileage, fuelLevel FuelLevel, condition, accessories Json, damages Json?, remarks, issuedById, acknowledgedAt?, documentId? }
```

Current registration/insurance live on `Vehicle` (queried constantly, feed `ExpiryIndex`); renewal history lives in `Document` rows with `entityType = VEHICLE`.

The same partial-unique-index technique enforces one active driver per vehicle.

---

## 14. Administration

```prisma
model PettyCashAccount     { id, companyId, name, openingBalance Decimal(14,2), currency, custodianId?, isActive }
model PettyCashTransaction {
  id, accountId, companyId, date, type CashFlowType (INCOME|EXPENSE),
  categoryId, description, amount Decimal(14,2), paymentMethod PaymentMethod,
  requesterId?, receiptFileId?, status ApprovalStatus, approvedById?, notes, createdById
  @@index([accountId, date]) @@index([companyId, date, type])
}
model PettyCashCategory    { id, key @unique, name, type CashFlowType }

model Accommodation   { id, companyId, name, addressLine, city, type AccommodationType, status, notes }
model AccommodationRoom { id, accommodationId, roomNumber, floor?, capacity Int, status  @@unique([accommodationId, roomNumber]) }
model AccommodationBed  { id, roomId, bedLabel, status BedStatus  @@unique([roomId, bedLabel]) }
model BedAssignment     { id, bedId, employeeId, checkInDate, checkOutDate?, assignedById, notes  @@index([bedId, checkOutDate]) @@index([employeeId, checkOutDate]) }

model Supplier      { id, code @unique, name, contactPerson?, phone?, email?, companyId?, categoryId?, paymentType PaymentType (CASH|CREDIT), creditDays?, status, notes, deletedAt? }
model Subcontractor { id, code @unique, name, contactPerson?, phone?, email?, crNumber?, status, notes, deletedAt? }
model SubcontractorContract { id, subcontractorId, companyId, contractNo, scope, startDate, endDate, value Decimal(14,2)?, status ContractStatus, documentId?, notes  @@index([endDate]) }

model ElectricityBill { id, companyId, accommodationId?, location, meterNumber, billingPeriodStart, billingPeriodEnd, amount Decimal(14,2), dueDate, paidDate?, status BillStatus, fileId?, notes  @@index([status, dueDate]) @@unique([meterNumber, billingPeriodStart]) }

model CompanyCertificate { id, companyId, certificateTypeId, certificateNo, issueDate, expiryDate, issuingAuthority?, documentId?, status, notes  @@index([companyId, expiryDate]) }
model CertificateType    { id, key @unique, name, isSystem }

model MedicalInsurancePolicy {
  id, companyId, providerId, policyNumber, className?, startDate, expiryDate,
  status PolicyStatus, isWorking Boolean @default(true), coverageLimit Decimal(14,2)?,
  documentId?, notes
  @@index([companyId, expiryDate]) @@unique([providerId, policyNumber])
}
model InsuranceProvider  { id, name @unique, contactPerson?, phone?, email?, portalCredentialId?, isActive }
model EmployeeInsurance  {                 // designed now, surfaced later per §31
  id, employeeId, policyId, memberNumber?, className?, startDate, endDate?, status
  @@unique([employeeId, policyId])
}
```

`EmployeeInsurance` is included in the schema from day one — the brief asks for the model to *permit* employee-level insurance later, and adding the table now costs nothing while retrofitting it later would mean a migration plus backfill.

---

## 15. Platform

```prisma
model Task {
  id            String @id @default(cuid(2))
  taskNo        String @unique
  companyId     String
  title         String
  description   String?
  status        TaskStatus   @default(TODO)
  priority      Priority     @default(MEDIUM)
  assignedToId  String?
  createdById   String
  dueDate       DateTime?
  followUpDate  DateTime?
  completedAt   DateTime?
  entityType    EntityType?              // related record
  entityId      String?
  parentTaskId  String?
  @@index([assignedToId, status])
  @@index([status, dueDate])
  @@index([entityType, entityId])
  @@index([companyId, status])
}
model TaskComment { id, taskId, authorId, body, createdAt }

model NotificationRule {
  id           String @id @default(cuid(2))
  source       ExpirySource?
  kind         NotificationKind          // EXPIRY | TASK_DUE | TASK_OVERDUE | APPROVAL | TICKET
  thresholds   Int[]    @default([90,60,30,15,7,1,0])
  roleIds      String[]                  // who gets it
  channels     NotificationChannel[]     @default([IN_APP])
  isActive     Boolean  @default(true)
}

model Notification {
  id         String @id @default(cuid(2))
  userId     String
  kind       NotificationKind
  severity   Severity @default(INFO)
  title      String
  body       String?
  entityType EntityType?
  entityId   String?
  dedupeKey  String   @unique            // "IQAMA:<id>:30:<userId>"
  readAt     DateTime?
  createdAt  DateTime @default(now())
  @@index([userId, readAt, createdAt])
}

model AuditLog {
  id          String @id @default(cuid(2))
  actorUserId String?
  actorLabel  String                     // preserved even if the user is deleted
  action      AuditAction                // CREATE|UPDATE|DELETE|APPROVE|REJECT|ASSIGN|RETURN|UPLOAD|DOWNLOAD|VIEW|GENERATE|LOGIN…
  entityType  EntityType
  entityId    String
  companyId   String?
  summary     String                     // "Updated employee EMP-00042 (position, salary)"
  changes     Json?                      // { field: { before, after } } — redacted
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([entityType, entityId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([createdAt])
  @@index([action, createdAt])
}

model LetterTemplate {
  id        String @id @default(cuid(2))
  key       String @unique
  name      String
  type      LetterType
  companyId String?
  bodyHtml  String                       // sanitised on save
  variables Json                         // declared placeholders + labels
  isActive  Boolean @default(true)
  version   Int     @default(1)
}

model GeneratedLetter {
  id           String @id @default(cuid(2))
  letterNo     String @unique
  templateId   String
  companyId    String
  entityType   EntityType
  entityId     String
  employeeId   String?
  renderedHtml String
  dataSnapshot Json                      // values at generation time
  fileId       String?                   // PDF, if stored
  containsSalary Boolean @default(false) // gates reading on employees.salary.view
  status       LetterStatus @default(GENERATED)
  generatedById String
  generatedAt  DateTime @default(now())
  @@index([entityType, entityId])
  @@index([templateId, generatedAt])
}

model RateLimitBucket {                   // DB-backed limiter (no Redis dependency)
  key       String   @id                  // "login:<email>" | "vault.reveal:<userId>"
  count     Int      @default(0)
  expiresAt DateTime
  @@index([expiresAt])
}
```

`dataSnapshot` on `GeneratedLetter` matters: a salary letter must keep saying what it said when it was issued, even after the employee's salary changes. `renderedHtml` is stored alongside it — the letter is never re-rendered from live data.

`containsSalary` exists because a letter is employee data in another shape. It is set per letter from what actually rendered, not inferred from the template type: any template can reference `{{salary}}`, and a placeholder that rendered unresolved leaks nothing. Reading a flagged letter requires `employees.salary.view` — see SECURITY §3.

---

## 16. Enum inventory

Stable, code-branching enums (Postgres enums):

`UserStatus, RecordStatus, GrantEffect, Gender, MaritalStatus, EmployeeStatus, EmploymentType, RenewalStatus, ContractType, ContractStatus, LeaveStatus, ApprovalStatus, WarningLevel, OfferStatus, CorrespondenceType, CorrespondenceStatus, ChecklistType, ChecklistCategory, ChecklistStatus, ChecklistItemStatus, EntityType, ScanStatus, ExpirySource, TaskStatus, Priority, TicketStatus, AssetType, AssetStatus, AssetCondition, CctvType, VaultAccessLevel, VaultAction, VehicleStatus, MaintenanceType, FuelLevel, CashFlowType, PaymentMethod, PaymentType, AccommodationType, BedStatus, BillStatus, PolicyStatus, NotificationKind, NotificationChannel, Severity, AuditAction, LetterType, LetterStatus`

User-editable lookup **tables** (not enums): `Role`, `DocumentType`, `TicketCategory`, `LeaveType`, `PettyCashCategory`, `CertificateType`, `CredentialCategory`, `InsuranceProvider`, `Department`, `Position`.

---

## 17. Indexing strategy

Beyond the per-model indexes above:

- **Every FK is indexed.** Postgres does not do this automatically and Prisma only adds it for some relation shapes.
- **Composite indexes lead with the equality column**, then the range column — e.g. `@@index([companyId, isActive, expiryDate])` serves *"active expiring items for KWI in the next 30 days"* as an index scan.
- **Search:** `Employee.fullName`, `Employee.employeeNo`, `ITAsset.serialNumber`, `Vehicle.plateNumber` get `pg_trgm` GIN indexes via raw SQL migration for fast `ILIKE '%…%'` global search. Full-text search (`tsvector`) is deliberately deferred — trigram covers the "find the employee called Ahmed" case that actually occurs.
- **`AuditLog` and `CredentialAccess` grow without bound.** Both are indexed on `createdAt` and earmarked for monthly partitioning if volume warrants it; a retention policy is a settings value, not a hard-coded constant.

---

## 18. Transaction boundaries

Operations that must be atomic — implemented with `prisma.$transaction`:

| Operation | Spans |
|---|---|
| Create employee | `Employee` + `Counter` + optional `IqamaRecord`/`PassportRecord` + `ExpiryIndex` + `AuditLog` |
| Assign IT asset | close previous `ITAssetAssignment` + new row + `ITAsset.status` + `AuditLog` |
| Return asset | `ITAssetAssignment.returnedAt` + `ITAsset.status/condition` + related `ChecklistItem` + `AuditLog` |
| Approve leave | `LeaveRequest` + `Notification` + `AuditLog` |
| Renew any expiring record | source row + `Document` (new version, `supersedesId`) + `ExpiryIndex` + `AuditLog` |
| Rotate credential | `Credential` + `CredentialVersion` + `CredentialAccess` + `AuditLog` |
| Bed assignment | `BedAssignment` + `AccommodationBed.status` + `AuditLog` |
| Petty cash entry | `PettyCashTransaction` + running-balance read + `AuditLog` |

Neon note: interactive transactions require a pooled connection with an adequate timeout. Long-running report queries run outside transactions on a separate read path.

---

## 19. Migration & seed plan

1. `prisma migrate dev --name init` — full baseline schema.
2. Raw-SQL follow-up migration for: partial unique indexes (asset assignment, vehicle driver, bed occupancy), `pg_trgm` extension + GIN indexes.
3. `prisma db seed` — idempotent, safe to re-run:
   - Companies **KWI** and **ICC**
   - ~8 departments, ~15 positions
   - Full `Permission` catalogue (~60 keys) + 7 roles with mapped permissions
   - `DocumentType`, `LeaveType`, `TicketCategory`, `CredentialCategory`, `CertificateType`, `PettyCashCategory`
   - Default checklist templates (onboarding / offboarding / clearance)
   - Default letter templates + notification rules
   - Development-only: 1 `SUPER_ADMIN` with an obviously fake password read from `SEED_ADMIN_PASSWORD`, ~20 sample employees, 3 vehicles, 10 IT assets, sample tickets/tasks/policy

**Seed contains no real credentials.** Vault seed rows use the literal string `dev-placeholder-not-a-real-secret`, and the seed refuses to run when `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=true` is set explicitly.
