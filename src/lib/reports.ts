/**
 * Report catalogue — brief §36.
 *
 * The load-bearing decision here is that a report's visible columns and its
 * exported columns are derived from ONE function of the actor's permissions.
 * Phase 11 shipped a leak of exactly this shape: a second read path (letters)
 * that did not repeat the gate its source data had. An export is a second read
 * path over every domain table at once, so it is the same bug waiting to
 * happen at eleven times the blast radius.
 *
 * Hence `visibleColumns(report, permissions)` — the screen and the file both
 * call it, and a column that is gated cannot appear in one but not the other.
 *
 * No server import: the catalogue is data, and the gating is testable directly.
 */

import type { PermissionKey } from "./permissions";

export const REPORT_IDS = [
  "employee-directory",
  "employee-headcount",
  "joiners-leavers",
  "expiry-register",
  "contract-register",
  "leave-register",
  "it-asset-register",
  "fleet-register",
  "insurance-register",
  "letter-register",
  "accommodation-occupancy",
  "subcontractor-register",
  "certificate-register",
  "warning-register",
  "job-offer-register",
  "job-description-register",
  "ip-phone-register",
  "cctv-register",
  "vehicle-maintenance",
  "vehicle-handover",
  "user-register",
  "role-register",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

export type ReportColumnSpec = {
  key: string;
  header: string;
  /**
   * When set, the column is omitted entirely unless the actor holds it.
   * Omitted — not blanked: a blank column tells the reader a value exists and
   * invites them to go looking for it elsewhere.
   */
  permission?: PermissionKey;
  align?: "left" | "right";
};

export type ReportSpec = {
  id: ReportId;
  name: string;
  description: string;
  module: string;
  /** Everything needs reports.view; this is the additional domain gate. */
  permission: PermissionKey;
  columns: readonly ReportColumnSpec[];
  filters: readonly ReportFilterKey[];
};

export const REPORT_FILTER_KEYS = [
  "companyId",
  "departmentId",
  "status",
  "from",
  "to",
  "q",
] as const;

export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

export const REPORTS: Record<ReportId, ReportSpec> = {
  "employee-directory": {
    id: "employee-directory",
    name: "Employee Directory",
    description:
      "Every employee with contact, position, and identity details. Salary and bank columns appear only for those authorised to see them.",
    module: "Employees",
    permission: "employees.view",
    filters: ["companyId", "departmentId", "status", "q"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Name" },
      { key: "fullNameAr", header: "Name (Arabic)" },
      { key: "company", header: "Company" },
      { key: "department", header: "Department" },
      { key: "position", header: "Position" },
      { key: "status", header: "Status" },
      { key: "nationality", header: "Nationality" },
      { key: "joiningDate", header: "Joining Date" },
      { key: "mobile", header: "Mobile" },
      { key: "workEmail", header: "Work Email" },
      { key: "iqamaNumber", header: "Iqama No." },
      { key: "iqamaExpiry", header: "Iqama Expiry" },
      // The two gated columns. Both are enforced at the query level too — the
      // service does not select what the actor may not see.
      { key: "basicSalary", header: "Basic Salary", permission: "employees.salary.view", align: "right" },
      { key: "iban", header: "IBAN", permission: "employees.bank.view" },
    ],
  },

  "employee-headcount": {
    id: "employee-headcount",
    name: "Headcount Summary",
    description: "Employee counts grouped by company, department, and status.",
    module: "Employees",
    permission: "employees.view",
    filters: ["companyId", "status"],
    columns: [
      { key: "company", header: "Company" },
      { key: "department", header: "Department" },
      { key: "active", header: "Active", align: "right" },
      { key: "onLeave", header: "On Leave", align: "right" },
      { key: "resigned", header: "Resigned", align: "right" },
      { key: "terminated", header: "Terminated", align: "right" },
      { key: "inactive", header: "Exited / Inactive", align: "right" },
      { key: "total", header: "Total", align: "right" },
    ],
  },

  "joiners-leavers": {
    id: "joiners-leavers",
    name: "Joiners & Leavers",
    description: "Employees who joined or left within the selected period.",
    module: "Employees",
    permission: "employees.view",
    filters: ["companyId", "departmentId", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Name" },
      { key: "company", header: "Company" },
      { key: "department", header: "Department" },
      { key: "position", header: "Position" },
      { key: "event", header: "Event" },
      { key: "eventDate", header: "Date" },
      { key: "status", header: "Status" },
    ],
  },

  "expiry-register": {
    id: "expiry-register",
    name: "Expiry Register",
    description:
      "Every expiring record in one place — Iqama, passport, contract, document, certificate, vehicle registration and insurance, medical insurance, and IT warranty.",
    module: "Compliance",
    permission: "reports.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "source", header: "Type" },
      { key: "label", header: "Record" },
      { key: "employee", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "expiryDate", header: "Expiry Date" },
      { key: "daysRemaining", header: "Days Remaining", align: "right" },
      { key: "bucket", header: "Bucket" },
    ],
  },

  "contract-register": {
    id: "contract-register",
    name: "Contract Register",
    description: "Employment contracts with type, period, and renewal status.",
    module: "HR",
    permission: "hr.contracts.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "contractType", header: "Type" },
      { key: "startDate", header: "Start" },
      { key: "endDate", header: "End" },
      { key: "probationEndDate", header: "Probation Ends" },
      { key: "status", header: "Status" },
      { key: "basicSalary", header: "Basic Salary", permission: "employees.salary.view", align: "right" },
      { key: "currency", header: "Currency" },
    ],
  },

  "leave-register": {
    id: "leave-register",
    name: "Leave Register",
    description: "Leave requests with type, period, and days.",
    module: "HR",
    permission: "hr.leave.view",
    filters: ["companyId", "departmentId", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "leaveType", header: "Leave Type" },
      { key: "startDate", header: "From" },
      { key: "endDate", header: "To" },
      { key: "days", header: "Days", align: "right" },
    ],
  },

  "it-asset-register": {
    id: "it-asset-register",
    name: "IT Asset Register",
    description: "Assets with category, status, assignment, and warranty expiry.",
    module: "IT",
    permission: "it.assets.view",
    filters: ["companyId", "status", "q"],
    columns: [
      { key: "assetCode", header: "Asset Code" },
      { key: "type", header: "Type" },
      { key: "brand", header: "Brand" },
      { key: "model", header: "Model" },
      { key: "serialNumber", header: "Serial No." },
      { key: "status", header: "Status" },
      { key: "condition", header: "Condition" },
      { key: "assignedTo", header: "Assigned To" },
      { key: "company", header: "Company" },
      { key: "purchaseDate", header: "Purchased" },
      { key: "warrantyExpiry", header: "Warranty Expiry" },
      { key: "purchaseCost", header: "Cost", align: "right" },
    ],
  },

  "fleet-register": {
    id: "fleet-register",
    name: "Fleet Register",
    description: "Vehicles with driver, registration and insurance expiry, and status.",
    module: "Fleet",
    permission: "vehicles.view",
    filters: ["companyId", "status", "q"],
    columns: [
      { key: "vehicleCode", header: "Code" },
      { key: "plateNumber", header: "Plate" },
      { key: "make", header: "Make" },
      { key: "model", header: "Model" },
      { key: "year", header: "Year", align: "right" },
      { key: "status", header: "Status" },
      { key: "currentDriver", header: "Driver" },
      { key: "company", header: "Company" },
      { key: "registrationExpiry", header: "Registration Expiry" },
      { key: "insuranceExpiry", header: "Insurance Expiry" },
    ],
  },

  "insurance-register": {
    id: "insurance-register",
    name: "Medical Insurance Register",
    description: "Policies with provider, class, expiry, member count, and whether the card actually works.",
    module: "Insurance",
    permission: "insurance.view",
    filters: ["companyId", "status"],
    columns: [
      { key: "policyNumber", header: "Policy No." },
      { key: "provider", header: "Provider" },
      { key: "company", header: "Company" },
      { key: "className", header: "Class" },
      { key: "startDate", header: "Start" },
      { key: "expiryDate", header: "Expiry" },
      { key: "status", header: "Status" },
      { key: "isWorking", header: "Working" },
      { key: "memberCount", header: "Members", align: "right" },
    ],
  },

  "letter-register": {
    id: "letter-register",
    name: "Letter Register",
    description: "Generated letters with type, recipient, and status.",
    module: "Letters",
    permission: "letters.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "letterNo", header: "Letter No." },
      { key: "type", header: "Type" },
      { key: "templateName", header: "Template" },
      { key: "employee", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "generatedAt", header: "Generated" },
      { key: "status", header: "Status" },
    ],
  },
  "accommodation-occupancy": {
    id: "accommodation-occupancy",
    name: "Accommodation Occupancy",
    description: "Who is housed where, and which beds are free.",
    module: "Administration",
    permission: "accommodation.view",
    filters: ["companyId", "status"],
    columns: [
      { key: "accommodation", header: "Accommodation" },
      { key: "company", header: "Company" },
      { key: "city", header: "City" },
      { key: "room", header: "Room" },
      { key: "bed", header: "Bed" },
      { key: "bedStatus", header: "Bed Status" },
      { key: "employeeNo", header: "Employee No." },
      { key: "occupant", header: "Occupant" },
      { key: "checkInDate", header: "Checked In" },
    ],
  },

  "subcontractor-register": {
    id: "subcontractor-register",
    name: "Subcontractor Register",
    description: "Subcontractors with CR number, contact, and contract count.",
    module: "Administration",
    permission: "subcontractors.view",
    filters: ["status", "q"],
    columns: [
      { key: "code", header: "Code" },
      { key: "name", header: "Subcontractor" },
      { key: "crNumber", header: "CR Number" },
      { key: "contactPerson", header: "Contact" },
      { key: "phone", header: "Phone" },
      { key: "contracts", header: "Contracts", align: "right" },
      { key: "status", header: "Status" },
    ],
  },

  "certificate-register": {
    id: "certificate-register",
    name: "Company Certificate Register",
    description: "Company certificates with issuer and expiry.",
    module: "Administration",
    permission: "certificates.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "certificateNo", header: "Certificate No." },
      { key: "type", header: "Type" },
      { key: "company", header: "Company" },
      { key: "issuingAuthority", header: "Issued By" },
      { key: "issueDate", header: "Issued" },
      { key: "expiryDate", header: "Expires" },
      { key: "status", header: "Status" },
    ],
  },

  "warning-register": {
    id: "warning-register",
    name: "Warning Letter Register",
    description: "Disciplinary letters by level and reason.",
    module: "HR",
    permission: "hr.warnings.view",
    filters: ["companyId", "departmentId", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "level", header: "Level" },
      { key: "reason", header: "Reason" },
      { key: "issuedDate", header: "Issued" },
    ],
  },

  "job-offer-register": {
    id: "job-offer-register",
    name: "Job Offer Register",
    description: "Offers by candidate, position, and decision state.",
    module: "HR",
    permission: "hr.offers.view",
    filters: ["companyId", "status", "from", "to", "q"],
    columns: [
      { key: "candidate", header: "Candidate" },
      { key: "company", header: "Company" },
      { key: "position", header: "Position" },
      // Same gate as every other salary column in the catalogue: an offer is a
      // salary disclosure before the person even joins.
      { key: "salary", header: "Proposed Salary", permission: "employees.salary.view", align: "right" },
      { key: "joiningDate", header: "Proposed Joining" },
      { key: "sentAt", header: "Sent" },
      { key: "status", header: "Status" },
    ],
  },

  "job-description-register": {
    id: "job-description-register",
    name: "Job Description Register",
    description: "Job descriptions by position, with version and active state.",
    module: "HR",
    permission: "hr.view",
    filters: ["companyId", "q"],
    columns: [
      { key: "title", header: "Title" },
      { key: "company", header: "Company" },
      { key: "position", header: "Position" },
      { key: "version", header: "Version", align: "right" },
      { key: "status", header: "Status" },
      { key: "updatedAt", header: "Updated" },
    ],
  },

  "ip-phone-register": {
    id: "ip-phone-register",
    name: "IP Phone Register",
    description: "Extensions, the handset each rings on, and who holds it.",
    module: "IT",
    permission: "it.infrastructure.view",
    filters: ["companyId", "status", "q"],
    columns: [
      { key: "extension", header: "Extension" },
      { key: "employee", header: "Employee" },
      { key: "assetCode", header: "Asset" },
      { key: "deviceModel", header: "Model" },
      { key: "macAddress", header: "MAC" },
      { key: "location", header: "Location" },
      { key: "status", header: "Status" },
    ],
  },

  "cctv-register": {
    id: "cctv-register",
    name: "CCTV Register",
    description: "Cameras and recorders by location, with last maintenance.",
    module: "IT",
    permission: "it.infrastructure.view",
    filters: ["companyId", "status", "q"],
    columns: [
      { key: "name", header: "Device" },
      { key: "assetCode", header: "Asset" },
      { key: "company", header: "Company" },
      { key: "type", header: "Type" },
      { key: "location", header: "Location" },
      { key: "ipAddress", header: "IP Address" },
      { key: "recorder", header: "Recorder" },
      { key: "lastMaintenanceAt", header: "Last Maintenance" },
      { key: "status", header: "Status" },
    ],
  },

  "vehicle-maintenance": {
    id: "vehicle-maintenance",
    name: "Vehicle Maintenance",
    description: "Work carried out per vehicle, with cost and next service due.",
    module: "Fleet",
    permission: "vehicles.maintenance.view",
    filters: ["companyId", "status", "from", "to", "q"],
    columns: [
      { key: "vehicle", header: "Vehicle" },
      { key: "plateNumber", header: "Plate" },
      { key: "date", header: "Date" },
      { key: "type", header: "Type" },
      { key: "description", header: "Work" },
      { key: "workshop", header: "Workshop" },
      { key: "cost", header: "Cost", align: "right" },
      { key: "nextDueDate", header: "Next Due" },
      { key: "status", header: "Status" },
    ],
  },

  "vehicle-handover": {
    id: "vehicle-handover",
    name: "Vehicle Handovers",
    description: "Who a vehicle passed from and to, with condition at the time.",
    module: "Fleet",
    permission: "vehicles.view",
    filters: ["companyId", "from", "to", "q"],
    columns: [
      { key: "vehicle", header: "Vehicle" },
      { key: "plateNumber", header: "Plate" },
      { key: "handoverDate", header: "Date" },
      { key: "fromEmployee", header: "From" },
      { key: "toEmployee", header: "To" },
      { key: "mileage", header: "Mileage", align: "right" },
      { key: "fuelLevel", header: "Fuel" },
      { key: "condition", header: "Condition" },
      { key: "acknowledged", header: "Acknowledged" },
    ],
  },

  "user-register": {
    id: "user-register",
    name: "User Account Register",
    description: "Accounts, their role, and when each last signed in.",
    module: "Settings",
    permission: "users.view",
    filters: ["status", "q"],
    columns: [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "role", header: "Role" },
      { key: "companies", header: "Companies" },
      { key: "status", header: "Status" },
      { key: "lastLoginAt", header: "Last Sign-in" },
    ],
  },

  "role-register": {
    id: "role-register",
    name: "Roles & Permissions",
    description: "Roles, their seniority, and how many permissions and people each has.",
    module: "Settings",
    permission: "roles.manage",
    filters: [],
    columns: [
      { key: "key", header: "Key" },
      { key: "name", header: "Role" },
      { key: "description", header: "Description" },
      { key: "rank", header: "Rank", align: "right" },
      { key: "isSystem", header: "Built-in" },
      { key: "permissions", header: "Permissions", align: "right" },
      { key: "users", header: "Users", align: "right" },
    ],
  },
};

export const REPORT_LIST: readonly ReportSpec[] = REPORT_IDS.map((id) => REPORTS[id]);

export function isReportId(value: string): value is ReportId {
  return (REPORT_IDS as readonly string[]).includes(value);
}

/**
 * The single derivation of what an actor may see.
 *
 * Both the on-screen table and the export call this. That is the whole point:
 * a gated column cannot be visible in one path and absent from the other,
 * because there is only one list.
 */
export function visibleColumns(
  report: ReportSpec,
  permissions: ReadonlySet<PermissionKey>,
): readonly ReportColumnSpec[] {
  return report.columns.filter(
    (column) => column.permission === undefined || permissions.has(column.permission),
  );
}

/** Reports the actor may open at all. */
export function visibleReports(
  permissions: ReadonlySet<PermissionKey>,
): readonly ReportSpec[] {
  if (!permissions.has("reports.view")) return [];
  return REPORT_LIST.filter((report) => permissions.has(report.permission));
}

/**
 * Whether a company filter is inside the actor's scope.
 *
 * Pure and exported so it can be tested directly. A report filter must be able
 * to narrow the scope and never widen it: an out-of-scope companyId is a denial,
 * not something to quietly ignore, because ignoring it returns MORE rows than
 * were asked for while looking like the filter worked.
 */
export function isCompanyInScope(
  companyScope: readonly string[] | "ALL",
  companyId: string,
): boolean {
  return companyScope === "ALL" || companyScope.includes(companyId);
}

/** Expiry buckets from brief §11, widest last so the first match is tightest. */
export const EXPIRY_BUCKETS = [7, 15, 30, 60, 90] as const;

export function expiryBucketLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return "Expired";
  for (const bucket of EXPIRY_BUCKETS) {
    if (daysRemaining <= bucket) return `${String(bucket)} days`;
  }
  return "Later";
}
