/**
 * The permission catalogue — the single source of truth, shared by the seed,
 * the role editor, and every server-side guard.
 *
 * Adding a permission here and re-running the seed is the only supported way to
 * introduce one. `PermissionKey` is a literal union, so a typo in
 * requirePermission("employees.updat") is a compile error, not a silent allow.
 */

export const PERMISSIONS = {
  // --- Core ---
  "dashboard.view": { module: "core", label: "View dashboard" },
  "search.global": { module: "core", label: "Use global search" },

  // --- Companies & org ---
  "companies.view": { module: "companies", label: "View companies" },
  "companies.manage": { module: "companies", label: "Create and edit companies" },
  "companies.viewAll": {
    module: "companies",
    label: "View data across all companies",
    sensitive: true,
  },
  "departments.view": { module: "companies", label: "View departments" },
  "departments.manage": { module: "companies", label: "Manage departments" },
  "positions.view": { module: "companies", label: "View positions" },
  "positions.manage": { module: "companies", label: "Manage positions" },

  // --- Employees ---
  "employees.view": { module: "employees", label: "View employees" },
  "employees.create": { module: "employees", label: "Create employees" },
  "employees.update": { module: "employees", label: "Edit employees" },
  "employees.delete": { module: "employees", label: "Remove employees", sensitive: true },
  "employees.export": { module: "employees", label: "Export employee data", sensitive: true },
  "employees.bank.view": {
    module: "employees",
    label: "View bank / IBAN details",
    sensitive: true,
  },
  "employees.bank.manage": {
    module: "employees",
    label: "Edit bank / IBAN details",
    sensitive: true,
  },
  "employees.salary.view": { module: "employees", label: "View salary data", sensitive: true },
  "employees.salary.manage": { module: "employees", label: "Edit salary data", sensitive: true },

  // --- Documents ---
  "documents.view": { module: "documents", label: "View documents" },
  "documents.upload": { module: "documents", label: "Upload documents" },
  "documents.download": { module: "documents", label: "Download documents" },
  "documents.delete": { module: "documents", label: "Delete documents" },
  "documents.manageTypes": { module: "documents", label: "Manage document types" },

  // --- HR ---
  "hr.view": { module: "hr", label: "View HR records" },
  "hr.manage": { module: "hr", label: "Manage HR records" },
  "hr.contracts.view": { module: "hr", label: "View contracts" },
  "hr.contracts.manage": { module: "hr", label: "Manage contracts" },
  "hr.leave.view": { module: "hr", label: "View leave requests" },
  "hr.leave.request": { module: "hr", label: "Submit leave requests" },
  "hr.leave.approve": { module: "hr", label: "Approve or reject leave" },
  "hr.timesheet.view": { module: "hr", label: "View and download timesheet files" },
  "hr.timesheet.manage": { module: "hr", label: "Upload and delete timesheet files" },
  "hr.evaluations.view": { module: "hr", label: "View evaluations" },
  "hr.evaluations.manage": { module: "hr", label: "Manage evaluations" },
  "hr.increments.view": { module: "hr", label: "View increment lists", sensitive: true },
  "hr.increments.manage": { module: "hr", label: "Manage increment lists", sensitive: true },
  "hr.warnings.view": { module: "hr", label: "View warning letters" },
  "hr.warnings.manage": { module: "hr", label: "Issue warning letters" },
  "hr.offers.view": { module: "hr", label: "View job offers" },
  "hr.offers.manage": { module: "hr", label: "Manage job offers" },

  // --- Administration ---
  "accommodation.view": { module: "admin", label: "View accommodation" },
  "accommodation.manage": { module: "admin", label: "Manage accommodation" },
  "subcontractors.view": { module: "admin", label: "View subcontractors" },
  "subcontractors.manage": { module: "admin", label: "Manage subcontractors" },
  "meters.view": { module: "admin", label: "View utility bills" },
  "meters.manage": { module: "admin", label: "Manage utility bills" },
  "certificates.view": { module: "admin", label: "View company certificates" },
  "certificates.manage": { module: "admin", label: "Manage company certificates" },

  // --- IT ---
  "it.view": { module: "it", label: "View IT section" },
  "it.manage": { module: "it", label: "Manage IT section" },
  "it.assets.view": { module: "it", label: "View IT assets" },
  "it.assets.manage": { module: "it", label: "Manage IT assets" },
  "it.assets.assign": { module: "it", label: "Assign and return IT assets" },
  "it.infrastructure.view": { module: "it", label: "View IT infrastructure" },
  "it.infrastructure.manage": { module: "it", label: "Manage IT infrastructure" },

  // --- Password vault (all sensitive) ---
  "vault.view": { module: "vault", label: "View vault entries", sensitive: true },
  "vault.reveal": { module: "vault", label: "Reveal stored passwords", sensitive: true },
  "vault.create": { module: "vault", label: "Create vault entries", sensitive: true },
  "vault.update": { module: "vault", label: "Edit vault entries", sensitive: true },
  "vault.delete": { module: "vault", label: "Delete vault entries", sensitive: true },
  "vault.export": { module: "vault", label: "Export vault entries", sensitive: true },
  "vault.grant": { module: "vault", label: "Grant vault access", sensitive: true },

  // --- Fleet ---
  "vehicles.view": { module: "vehicles", label: "View vehicles" },
  "vehicles.manage": { module: "vehicles", label: "Manage vehicles" },
  "vehicles.assign": { module: "vehicles", label: "Assign drivers" },
  "vehicles.maintenance.view": { module: "vehicles", label: "View maintenance" },
  "vehicles.maintenance.manage": { module: "vehicles", label: "Manage maintenance" },

  // --- Insurance ---
  "insurance.view": { module: "insurance", label: "View insurance policies" },
  "insurance.manage": { module: "insurance", label: "Manage insurance policies" },

  // --- Letters ---
  "letters.view": { module: "letters", label: "View generated letters" },
  "letters.generate": { module: "letters", label: "Generate letters" },
  "letters.manageTemplates": { module: "letters", label: "Manage letter templates" },

  // --- Platform ---
  "reports.view": { module: "platform", label: "View reports" },
  "reports.export": { module: "platform", label: "Export reports", sensitive: true },
  "notifications.view": { module: "platform", label: "View notifications" },
  "notifications.manageRules": { module: "platform", label: "Manage notification rules" },
  "audit.view": { module: "platform", label: "View audit log", sensitive: true },
  "audit.export": { module: "platform", label: "Export audit log", sensitive: true },
  "users.view": { module: "platform", label: "View users", sensitive: true },
  "users.manage": { module: "platform", label: "Manage users", sensitive: true },
  "roles.manage": { module: "platform", label: "Manage roles and permissions", sensitive: true },
  "settings.manage": { module: "platform", label: "Manage system settings", sensitive: true },
} as const satisfies Record<string, { module: string; label: string; sensitive?: boolean }>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

/**
 * Narrows a string from the database to a known permission key.
 *
 * The `Permission` table is seeded from this catalogue, but a row could outlive
 * a key that was renamed or removed. Anything not in the catalogue cannot be
 * reasoned about, so it is treated as unknown rather than trusted.
 */
export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(PERMISSIONS, value);
}

export function isSensitive(key: PermissionKey): boolean {
  return "sensitive" in PERMISSIONS[key] && PERMISSIONS[key].sensitive === true;
}

// --- Roles -------------------------------------------------------------------

/** The one role that bypasses the permission set entirely. Defined here so the
 *  request context and the notification recipient resolver agree on it. */
export const SUPER_ADMIN_ROLE_KEY = "SUPER_ADMIN";

export const ROLE_KEYS = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR",
  "IT_ADMIN",
  "MANAGER",
  "USER",
  "VIEWER",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

const allPermissions = PERMISSION_KEYS;

const nonSensitiveViewPermissions = PERMISSION_KEYS.filter(
  (key) => key.endsWith(".view") && !isSensitive(key),
);

/**
 * Seed role → permission mapping (docs/MODULES.md §4).
 *
 * Two rules are load-bearing:
 *   1. HR and ADMIN receive ZERO vault.* permissions.
 *   2. VIEWER gets no sensitive permissions, so the directory never leaks
 *      IBANs or salaries.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  SUPER_ADMIN: allPermissions,

  ADMIN: PERMISSION_KEYS.filter(
    (key) =>
      !key.startsWith("vault.") &&
      key !== "roles.manage" &&
      key !== "users.manage" &&
      key !== "audit.export",
  ),

  HR: [
    "dashboard.view",
    "search.global",
    "companies.view",
    "departments.view",
    "positions.view",
    "positions.manage",
    "employees.view",
    "employees.create",
    "employees.update",
    "employees.export",
    "employees.bank.view",
    "employees.bank.manage",
    "employees.salary.view",
    "employees.salary.manage",
    "documents.view",
    "documents.upload",
    "documents.download",
    "documents.delete",
    "hr.view",
    "hr.manage",
    "hr.contracts.view",
    "hr.contracts.manage",
    "hr.leave.view",
    "hr.leave.request",
    "hr.leave.approve",
    "hr.timesheet.view",
    "hr.timesheet.manage",
    "hr.evaluations.view",
    "hr.evaluations.manage",
    "hr.increments.view",
    "hr.increments.manage",
    "hr.warnings.view",
    "hr.warnings.manage",
    "hr.offers.view",
    "hr.offers.manage",
    "accommodation.view",
    "certificates.view",
    "letters.view",
    "letters.generate",
    "reports.view",
    "reports.export",
    "notifications.view",
    "insurance.view",
  ],

  IT_ADMIN: [
    "dashboard.view",
    "search.global",
    "companies.view",
    "departments.view",
    "employees.view",
    "documents.view",
    "documents.upload",
    "documents.download",
    "it.view",
    "it.manage",
    "it.assets.view",
    "it.assets.manage",
    "it.assets.assign",
    "it.infrastructure.view",
    "it.infrastructure.manage",
    // Deliberately NOT vault.delete / vault.export / vault.grant.
    "vault.view",
    "vault.reveal",
    "vault.create",
    "vault.update",
    "reports.view",
    "notifications.view",
    "letters.view",
    "letters.generate",
  ],

  MANAGER: [
    "dashboard.view",
    "search.global",
    "companies.view",
    "departments.view",
    "employees.view",
    "documents.view",
    "documents.download",
    "hr.view",
    "hr.leave.view",
    "hr.leave.request",
    "hr.leave.approve",
    "hr.timesheet.view",
    "hr.evaluations.view",
    "hr.evaluations.manage",
    "reports.view",
    "notifications.view",
  ],

  USER: [
    "dashboard.view",
    "search.global",
    "hr.leave.request",
    "notifications.view",
    "documents.view",
  ],

  VIEWER: nonSensitiveViewPermissions,
};

/** Lower rank = more senior. Blocks editing a role senior to your own. */
export const ROLE_RANKS: Record<RoleKey, number> = {
  SUPER_ADMIN: 0,
  ADMIN: 10,
  HR: 20,
  IT_ADMIN: 20,
  MANAGER: 30,
  USER: 40,
  VIEWER: 50,
};

// --- Permission resolution ---------------------------------------------------

/**
 * Every permission in the catalogue — what SUPER_ADMIN resolves to.
 *
 * A plain Set, deliberately: `PermissionKey` is derived from `PERMISSIONS`, so
 * this genuinely contains every valid key and needs no Proxy trickery. (An
 * earlier Proxy that forced `has()` to return true broke `.size`, because
 * `Set.prototype.size` requires a real Set as its receiver.)
 */
export const ALL_PERMISSIONS: ReadonlySet<PermissionKey> = new Set<PermissionKey>(
  PERMISSION_KEYS,
);

export type PermissionOverride = {
  key: string;
  effect: "ALLOW" | "DENY";
  expiresAt: Date | null;
};

/**
 * effective = (role ∪ unexpired ALLOW overrides) − (unexpired DENY overrides)
 *
 * DENY always wins; SUPER_ADMIN short-circuits to everything. Kept free of any
 * database or request dependency so it is directly unit-testable — this is the
 * function every authorisation decision in the system rests on.
 */
export function resolvePermissions(input: {
  rolePermissions: readonly string[];
  overrides: readonly PermissionOverride[];
  isSuperAdmin: boolean;
  now?: Date;
}): ReadonlySet<PermissionKey> {
  if (input.isSuperAdmin) return ALL_PERMISSIONS;

  const now = input.now ?? new Date();
  const active = input.overrides.filter((o) => !o.expiresAt || o.expiresAt > now);

  const effective = new Set<string>(input.rolePermissions);
  for (const o of active) {
    if (o.effect === "ALLOW") effective.add(o.key);
  }
  // Applied last so DENY beats both the role grant and any ALLOW override.
  for (const o of active) {
    if (o.effect === "DENY") effective.delete(o.key);
  }

  return effective as ReadonlySet<PermissionKey>;
}

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Full system access including vault, roles, and audit export.",
  ADMIN: "Full operational access. No vault, user, or role administration.",
  HR: "People, HR, documents, and letters. No IT or vault access.",
  IT_ADMIN: "IT assets, infrastructure, and day-to-day vault use.",
  MANAGER: "Own department: approvals and evaluations.",
  USER: "Self-service: own leave requests.",
  VIEWER: "Read-only across non-sensitive modules.",
};
