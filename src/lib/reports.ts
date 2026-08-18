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
  "helpdesk-tickets",
  "fleet-register",
  "insurance-register",
  "task-register",
  "letter-register",
  "petty-cash-ledger",
  "accommodation-occupancy",
  "supplier-register",
  "subcontractor-register",
  "electricity-bills",
  "certificate-register",
  "timesheet-summary",
  "evaluation-register",
  "increment-register",
  "warning-register",
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
    description: "Leave requests with type, period, days, and approval state.",
    module: "HR",
    permission: "hr.leave.view",
    filters: ["companyId", "departmentId", "status", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "leaveType", header: "Leave Type" },
      { key: "startDate", header: "From" },
      { key: "endDate", header: "To" },
      { key: "days", header: "Days", align: "right" },
      { key: "status", header: "Status" },
      { key: "approver", header: "Approver" },
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

  "helpdesk-tickets": {
    id: "helpdesk-tickets",
    name: "Helpdesk Tickets",
    description: "Tickets with category, priority, assignment, and age.",
    module: "IT",
    permission: "it.tickets.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "ticketNo", header: "Ticket No." },
      { key: "subject", header: "Subject" },
      { key: "category", header: "Category" },
      { key: "priority", header: "Priority" },
      { key: "status", header: "Status" },
      { key: "requester", header: "Raised By" },
      { key: "assignedTo", header: "Assigned To" },
      { key: "createdAt", header: "Created" },
      { key: "resolvedAt", header: "Resolved" },
      { key: "ageDays", header: "Age (days)", align: "right" },
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

  "task-register": {
    id: "task-register",
    name: "Task Register",
    description: "Tasks with assignee, priority, due date, and overdue flag.",
    module: "Tasks",
    permission: "tasks.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "taskNo", header: "Task No." },
      { key: "title", header: "Title" },
      { key: "priority", header: "Priority" },
      { key: "status", header: "Status" },
      { key: "assignedTo", header: "Assigned To" },
      { key: "dueDate", header: "Due" },
      { key: "isOverdue", header: "Overdue" },
      { key: "company", header: "Company" },
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
  "petty-cash-ledger": {
    id: "petty-cash-ledger",
    name: "Petty Cash Ledger",
    description: "Every transaction with its account, category, and approval state.",
    module: "Administration",
    permission: "pettycash.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "date", header: "Date" },
      { key: "account", header: "Account" },
      { key: "company", header: "Company" },
      { key: "type", header: "Type" },
      { key: "category", header: "Category" },
      { key: "description", header: "Description" },
      { key: "amount", header: "Amount", align: "right" },
      { key: "currency", header: "Currency" },
      { key: "paymentMethod", header: "Method" },
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

  "supplier-register": {
    id: "supplier-register",
    name: "Supplier Register",
    description: "Suppliers with category, contact, and credit terms.",
    module: "Administration",
    permission: "suppliers.view",
    filters: ["companyId", "status", "q"],
    columns: [
      { key: "code", header: "Code" },
      { key: "name", header: "Supplier" },
      { key: "company", header: "Company" },
      { key: "category", header: "Category" },
      { key: "contactPerson", header: "Contact" },
      { key: "phone", header: "Phone" },
      { key: "email", header: "Email" },
      { key: "creditDays", header: "Credit Days", align: "right" },
      { key: "status", header: "Status" },
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

  "electricity-bills": {
    id: "electricity-bills",
    name: "Electricity Bills",
    description: "Bills by period and location, with payment state.",
    module: "Administration",
    permission: "bills.view",
    filters: ["companyId", "status", "from", "to"],
    columns: [
      { key: "location", header: "Location" },
      { key: "company", header: "Company" },
      { key: "meterNumber", header: "Meter" },
      { key: "periodStart", header: "Period From" },
      { key: "periodEnd", header: "Period To" },
      { key: "amount", header: "Amount", align: "right" },
      { key: "currency", header: "Currency" },
      { key: "dueDate", header: "Due" },
      { key: "paidDate", header: "Paid" },
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

  "timesheet-summary": {
    id: "timesheet-summary",
    name: "Timesheet Summary",
    description: "Recorded hours per employee, with overtime and delayed hours.",
    module: "HR",
    permission: "hr.timesheet.view",
    filters: ["companyId", "departmentId", "status", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "date", header: "Date" },
      { key: "normalHours", header: "Normal", align: "right" },
      { key: "overtimeHours", header: "Overtime", align: "right" },
      { key: "delayedHours", header: "Delayed", align: "right" },
      { key: "absent", header: "Absent" },
      { key: "status", header: "Status" },
    ],
  },

  "evaluation-register": {
    id: "evaluation-register",
    name: "Evaluation Register",
    description: "Performance reviews by period, with score and approval state.",
    module: "HR",
    permission: "hr.evaluations.view",
    filters: ["companyId", "departmentId", "status", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "periodStart", header: "Period From" },
      { key: "periodEnd", header: "Period To" },
      { key: "overallScore", header: "Score", align: "right" },
      { key: "status", header: "Status" },
    ],
  },

  "increment-register": {
    id: "increment-register",
    name: "Increment Register",
    description: "Salary increases by effective date and approval state.",
    module: "HR",
    permission: "hr.increments.view",
    filters: ["companyId", "departmentId", "status", "from", "to"],
    columns: [
      { key: "employeeNo", header: "Employee No." },
      { key: "fullName", header: "Employee" },
      { key: "company", header: "Company" },
      { key: "effectiveDate", header: "Effective" },
      // The figures are a separate permission from seeing that a rise happened:
      // holding hr.increments.view does not imply employees.salary.view.
      { key: "currentSalary", header: "From", permission: "employees.salary.view", align: "right" },
      { key: "newSalary", header: "To", permission: "employees.salary.view", align: "right" },
      { key: "amount", header: "Increase", permission: "employees.salary.view", align: "right" },
      { key: "percentage", header: "%", permission: "employees.salary.view", align: "right" },
      { key: "currency", header: "Currency" },
      { key: "status", header: "Status" },
    ],
  },

  "warning-register": {
    id: "warning-register",
    name: "Warning Letter Register",
    description: "Disciplinary letters by level, with acknowledgement state.",
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
      { key: "acknowledgedAt", header: "Acknowledged" },
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
