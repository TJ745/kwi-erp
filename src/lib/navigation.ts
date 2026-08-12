import type { PermissionKey } from "./permissions";

/**
 * The sidebar, command menu, and breadcrumbs all derive from this one tree
 * (docs/MODULES.md §5). A section renders only when the actor holds at least
 * one child's permission, so empty headings never appear.
 *
 * Routes not yet built are marked `planned` — they show as disabled rather than
 * silently 404ing, which is honest about what exists.
 */

export type NavItem = {
  label: string;
  href: string;
  /** Any one of these grants visibility. */
  permissions: readonly PermissionKey[];
  /** Not yet implemented — rendered disabled. */
  planned?: boolean;
  /** Extra terms for the command menu. */
  keywords?: readonly string[];
};

export type NavSection = {
  label: string;
  icon: NavIconName;
  items: readonly NavItem[];
};

/** Icon names resolved in the client component; keeps this module isomorphic. */
export type NavIconName =
  | "dashboard"
  | "people"
  | "hr"
  | "documents"
  | "tasks"
  | "it"
  | "vehicles"
  | "insurance"
  | "reports"
  | "notifications"
  | "audit"
  | "settings";

export const NAVIGATION: readonly NavSection[] = [
  {
    label: "Overview",
    icon: "dashboard",
    items: [{ label: "Dashboard", href: "/dashboard", permissions: ["dashboard.view"] }],
  },
  {
    label: "People",
    icon: "people",
    items: [
      { label: "Employees", href: "/people/employees", permissions: ["employees.view"] },
      {
        label: "Iqama & Passports",
        href: "/people/iqama",
        permissions: ["employees.view"],
        keywords: ["residency", "expiry", "renewal"],
      },
      { label: "Onboarding", href: "/people/onboarding", permissions: ["hr.onboarding.view"] },
      { label: "Offboarding", href: "/people/offboarding", permissions: ["hr.offboarding.view"], keywords: ["clearance", "exit"] },
      { label: "Leave", href: "/people/leave", permissions: ["hr.leave.view", "hr.leave.request"] },
      { label: "Timesheet", href: "/people/timesheet", permissions: ["hr.timesheet.view"], planned: true, keywords: ["delayed hours", "overtime"] },
      { label: "Organisation Chart", href: "/people/org-chart", permissions: ["employees.view"], planned: true },
    ],
  },
  {
    label: "HR & Admin",
    icon: "hr",
    items: [
      { label: "Letters & Memos", href: "/hr/letters", permissions: ["letters.view"], planned: true },
      { label: "Contracts", href: "/hr/contracts", permissions: ["hr.contracts.view"] },
      { label: "Job Offers", href: "/hr/offers", permissions: ["hr.offers.view"], planned: true },
      { label: "Job Descriptions", href: "/hr/job-descriptions", permissions: ["hr.view"], planned: true },
      { label: "Evaluations", href: "/hr/evaluations", permissions: ["hr.evaluations.view"], planned: true },
      { label: "Increments", href: "/hr/increments", permissions: ["hr.increments.view"], planned: true },
      { label: "Warning Letters", href: "/hr/warnings", permissions: ["hr.warnings.view"], planned: true },
      { label: "Correspondence", href: "/hr/correspondence", permissions: ["hr.correspondence.view"], planned: true },
      { label: "Petty Cash", href: "/admin/petty-cash", permissions: ["pettycash.view"], planned: true },
      { label: "Accommodation", href: "/admin/accommodation", permissions: ["accommodation.view"], planned: true },
      { label: "Suppliers", href: "/admin/suppliers", permissions: ["suppliers.view"], planned: true },
      { label: "Subcontractors", href: "/admin/subcontractors", permissions: ["subcontractors.view"], planned: true },
      { label: "Electricity Bills", href: "/admin/electricity-bills", permissions: ["bills.view"], planned: true },
      { label: "Company Certificates", href: "/admin/certificates", permissions: ["certificates.view"], planned: true },
    ],
  },
  {
    label: "Documents",
    icon: "documents",
    items: [{ label: "Documents", href: "/documents", permissions: ["documents.view"], planned: true }],
  },
  {
    label: "Tasks",
    icon: "tasks",
    items: [{ label: "Tasks & Follow-ups", href: "/tasks", permissions: ["tasks.view"] }],
  },
  {
    label: "IT",
    icon: "it",
    items: [
      { label: "Helpdesk", href: "/it/helpdesk", permissions: ["it.tickets.view", "it.tickets.create"] },
      { label: "Assets", href: "/it/assets", permissions: ["it.assets.view"] },
      { label: "Servers", href: "/it/servers", permissions: ["it.infrastructure.view"], planned: true },
      { label: "Active Directory", href: "/it/active-directory", permissions: ["it.infrastructure.view"], planned: true },
      { label: "Network & IP", href: "/it/network", permissions: ["it.infrastructure.view"], planned: true },
      { label: "IP Phones", href: "/it/ip-phones", permissions: ["it.infrastructure.view"], planned: true },
      { label: "CCTV", href: "/it/cctv", permissions: ["it.infrastructure.view"], planned: true },
      { label: "Software & Licences", href: "/it/software", permissions: ["it.infrastructure.view"], planned: true },
      {
        label: "Password Vault",
        href: "/it/vault",
        permissions: ["vault.view"],
        keywords: ["credentials", "passwords", "secrets"],
      },
    ],
  },
  {
    label: "Vehicles",
    icon: "vehicles",
    items: [
      { label: "Vehicles", href: "/vehicles", permissions: ["vehicles.view"] },
      { label: "Maintenance", href: "/vehicles/maintenance", permissions: ["vehicles.maintenance.view"] },
      { label: "Handovers", href: "/vehicles/handovers", permissions: ["vehicles.view"], planned: true },
    ],
  },
  {
    label: "Insurance",
    icon: "insurance",
    items: [{ label: "Medical Insurance", href: "/insurance", permissions: ["insurance.view"] }],
  },
  {
    label: "Platform",
    icon: "reports",
    items: [
      { label: "Reports", href: "/reports", permissions: ["reports.view"], planned: true },
      { label: "Notifications", href: "/notifications", permissions: ["notifications.view"], planned: true },
      { label: "Audit Logs", href: "/audit", permissions: ["audit.view"], planned: true },
    ],
  },
  {
    label: "Settings",
    icon: "settings",
    items: [
      { label: "Companies", href: "/settings/companies", permissions: ["companies.view"] },
      { label: "Departments", href: "/settings/departments", permissions: ["departments.view"] },
      { label: "Users", href: "/settings/users", permissions: ["users.view"] },
      { label: "Roles & Permissions", href: "/settings/roles", permissions: ["roles.manage"] },
      { label: "Document Types", href: "/settings/document-types", permissions: ["documents.manageTypes"], planned: true },
      { label: "Checklist Templates", href: "/settings/checklists", permissions: ["settings.manage"], planned: true },
      { label: "Letter Templates", href: "/settings/templates", permissions: ["letters.manageTemplates"], planned: true },
    ],
  },
];

/** Items the actor may see, with empty sections dropped. */
export function visibleNavigation(
  permissions: ReadonlySet<PermissionKey>,
): NavSection[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.permissions.some((p) => permissions.has(p))),
  })).filter((section) => section.items.length > 0);
}

/** Longest matching route, so /people/employees/123 resolves to Employees. */
export function findNavItem(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;

  for (const section of NAVIGATION) {
    for (const item of section.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (!best || item.href.length > best.item.href.length)) {
        best = { section, item };
      }
    }
  }
  return best;
}
