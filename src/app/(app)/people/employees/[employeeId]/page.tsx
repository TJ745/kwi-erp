import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpiryAlert, ExpiryDate } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { DocumentUpload } from "@/components/forms/document-upload";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getEmployee } from "@/server/services/employees";
import { documentsForEntity, documentTypes } from "@/server/services/documents";
import { assetsForEmployee } from "@/server/services/assets";
import { allowanceValue, contractsForEmployee } from "@/server/services/contracts";
import { ContractDialog } from "./contract-dialog";
import { EmployeeStatusDialog } from "./status-dialog";
import { leaveForEmployee } from "@/server/services/leave";
import { listTimesheet } from "@/server/services/hiring";
import {
  listCorrespondence,
  listEvaluations,
  listIncrements,
  listWarnings,
} from "@/server/services/hr-records";
import { accommodationForEmployee } from "@/server/services/accommodation";
import { checklistsForEmployee } from "@/server/services/checklists";
import { tasksForEntity } from "@/server/services/tasks";
import { listAuditEntries } from "@/server/services/platform";
import { enrolmentsForEmployee } from "@/server/services/insurance";
import {
  bankDetailFor,
  iqamaRenewals,
  listEmergencyContacts,
} from "@/server/services/employees";
import { AuditChanges } from "@/app/(app)/audit/audit-changes";
import { DocumentList } from "./document-list";
import { IdentityDocuments } from "./identity-documents";
import { IqamaRenewals } from "./iqama-renewals";
import { EmergencyContacts } from "./emergency-contacts";
import { BankDetails } from "./bank-details";

export const metadata: Metadata = { title: "Employee" };

/**
 * Employee profile — the 18 tabs from the brief (§8).
 *
 * Every tab carries its own permission and is fetched only when the actor
 * holds it, so a tab they cannot see is never queried and its data never
 * reaches the RSC payload. That matters most on Increment, where the service
 * additionally nulls the figures without `employees.salary.view`: an actor may
 * legitimately see that a rise happened without seeing its amount.
 *
 * Bank details are the same shape of problem: the query does not run at all
 * without `employees.bank.view`, so an IBAN never reaches the payload of
 * someone who happens to hold `employees.view`.
 */
export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const ctx = await requirePagePermission("employees.view");
  const { employeeId } = await params;
  const employee = await getEmployee(ctx, employeeId);

  const canEdit = ctx.permissions.has("employees.update");
  const canViewDocuments = ctx.permissions.has("documents.view");
  const canUpload = ctx.permissions.has("documents.upload");

  const canViewContracts = ctx.permissions.has("hr.contracts.view");
  const canViewLeave = ctx.permissions.has("hr.leave.view");
  const canViewAssets = ctx.permissions.has("it.assets.view");

  // Each tab carries its own permission. A tab the actor cannot see is never
  // queried, so its data never reaches the RSC payload — the salary figures on
  // the increments tab are the reason that matters.
  const canViewTimesheet = ctx.permissions.has("hr.timesheet.view");
  const canViewEvaluations = ctx.permissions.has("hr.evaluations.view");
  const canViewWarnings = ctx.permissions.has("hr.warnings.view");
  const canViewIncrements = ctx.permissions.has("hr.increments.view");
  const canViewAccommodation = ctx.permissions.has("accommodation.view");
  const canViewChecklists = ctx.permissions.has("hr.onboarding.view");
  const canViewTasks = ctx.permissions.has("tasks.view");
  const canViewCorrespondence = ctx.permissions.has("hr.correspondence.view");
  const canViewAudit = ctx.permissions.has("audit.view");
  const canSeeSalaryFigures = ctx.permissions.has("employees.salary.view");
  // Bank details are their own sensitive surface: the query does not run at all
  // without the permission, so an IBAN never reaches the payload uninvited.
  const canViewBank = ctx.permissions.has("employees.bank.view");
  const canViewInsurance = ctx.permissions.has("insurance.view");
  const canManageBank = ctx.permissions.has("employees.bank.manage");

  const [
    documents,
    types,
    contracts,
    leave,
    assets,
    timesheet,
    evaluations,
    warnings,
    increments,
    accommodation,
    checklists,
    employeeTasks,
    correspondence,
    auditHistory,
    renewals,
    emergencyContacts,
    bankDetail,
    insurance,
  ] = await Promise.all([
    canViewDocuments
      ? documentsForEntity(ctx, "EMPLOYEE", employee.id)
      : Promise.resolve([]),
    canViewDocuments && canUpload ? documentTypes() : Promise.resolve([]),
    canViewContracts ? contractsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewLeave ? leaveForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewAssets ? assetsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewTimesheet
      ? listTimesheet(ctx, { employeeId: employee.id })
      : Promise.resolve(null),
    canViewEvaluations
      ? listEvaluations(ctx, { employeeId: employee.id })
      : Promise.resolve([]),
    canViewWarnings ? listWarnings(ctx, { employeeId: employee.id }) : Promise.resolve([]),
    canViewIncrements
      ? listIncrements(ctx, { employeeId: employee.id })
      : Promise.resolve([]),
    canViewAccommodation
      ? accommodationForEmployee(ctx, employee.id)
      : Promise.resolve([]),
    canViewChecklists ? checklistsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewTasks ? tasksForEntity(ctx, "EMPLOYEE", employee.id) : Promise.resolve([]),
    canViewCorrespondence
      ? listCorrespondence(ctx, { employeeId: employee.id })
      : Promise.resolve([]),
    canViewAudit
      ? listAuditEntries(ctx, { entityType: "EMPLOYEE", entityId: employee.id })
      : Promise.resolve(null),
    iqamaRenewals(ctx, employee.id),
    listEmergencyContacts(ctx, employee.id),
    canViewBank ? bankDetailFor(ctx, employee.id) : Promise.resolve(null),
    canViewInsurance ? enrolmentsForEmployee(ctx, employee.id) : Promise.resolve([]),
  ]);

  const onboarding = checklists.filter((c) => c.type === "ONBOARDING");
  const offboarding = checklists.filter((c) => c.type !== "ONBOARDING");

  // Only currently-held assets matter for offboarding; history is on the asset.
  const heldAssets = assets.filter((a) => a.returnedAt === null);

  return (
    <PageShell>
      <Link
        href="/people/employees"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to employees
      </Link>

      <PageHeader
        title={employee.fullName}
        description={`${employee.employeeNo} · ${employee.company.code}${
          employee.position ? ` · ${employee.position.title}` : ""
        }`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={employee.status} />
            {canEdit ? (
              <>
                <EmployeeStatusDialog
                  employee={{
                    id: employee.id,
                    fullName: employee.fullName,
                    status: employee.status,
                    lastWorkingDate: employee.lastWorkingDate
                      ? employee.lastWorkingDate.toISOString().slice(0, 10)
                      : null,
                  }}
                />
                <Link
                  href={`/people/employees/${employee.id}/edit`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil />
                  Edit
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="identity">Iqama &amp; Passport</TabsTrigger>
            {canViewDocuments ? (
              <TabsTrigger value="documents">
                Documents{documents.length > 0 ? ` (${String(documents.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewContracts ? (
              <TabsTrigger value="contracts">
                Contracts{contracts.length > 0 ? ` (${String(contracts.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewLeave ? (
              <TabsTrigger value="leave">
                Leave{leave.length > 0 ? ` (${String(leave.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewAssets ? (
              <TabsTrigger value="assets">
                IT Assets{heldAssets.length > 0 ? ` (${String(heldAssets.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewTimesheet ? (
              <TabsTrigger value="timesheet">
                Timesheet
                {timesheet && timesheet.entries.length > 0
                  ? ` (${String(timesheet.entries.length)})`
                  : ""}
              </TabsTrigger>
            ) : null}
            {canViewEvaluations ? (
              <TabsTrigger value="evaluations">
                Evaluation{evaluations.length > 0 ? ` (${String(evaluations.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewWarnings ? (
              <TabsTrigger value="warnings">
                Warnings{warnings.length > 0 ? ` (${String(warnings.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewIncrements ? (
              <TabsTrigger value="increments">
                Increment{increments.length > 0 ? ` (${String(increments.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewAccommodation ? (
              <TabsTrigger value="accommodation">
                Accommodation
                {accommodation.length > 0 ? ` (${String(accommodation.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewChecklists ? (
              <TabsTrigger value="onboarding">
                Onboarding{onboarding.length > 0 ? ` (${String(onboarding.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewChecklists ? (
              <TabsTrigger value="offboarding">
                Offboarding{offboarding.length > 0 ? ` (${String(offboarding.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewTasks ? (
              <TabsTrigger value="tasks">
                Tasks{employeeTasks.length > 0 ? ` (${String(employeeTasks.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewCorrespondence ? (
              <TabsTrigger value="correspondence">
                Correspondence
                {correspondence.length > 0 ? ` (${String(correspondence.length)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewAudit ? <TabsTrigger value="audit">History</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Personal</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    ["Full name", employee.fullName],
                    ["Arabic name", employee.fullNameAr],
                    ["Gender", titleCase(employee.gender)],
                    ["Date of birth", formatDate(employee.dateOfBirth)],
                    ["Nationality", employee.nationality],
                    ["Marital status", employee.maritalStatus ? titleCase(employee.maritalStatus) : null],
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    ["Mobile", employee.mobile],
                    ["Work email", employee.workEmail],
                    ["Personal email", employee.personalEmail],
                    [
                      "System account",
                      employee.userAccount
                        ? `${employee.userAccount.email} (${employee.userAccount.status})`
                        : null,
                    ],
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <EmergencyContacts
            employeeId={employee.id}
            canEdit={canEdit}
            contacts={emergencyContacts}
          />

          {canViewInsurance && insurance.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Medical insurance</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insurance.map((cover) => (
                    <li
                      key={cover.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{cover.policy.provider.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {cover.policy.policyNumber}
                          {cover.className ? ` · class ${cover.className}` : ""}
                          {cover.memberNumber ? ` · member ${cover.memberNumber}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={cover.status} />
                        <p className="text-muted-foreground text-xs">
                          {cover.startDate.toISOString().slice(0, 10)} →{" "}
                          {cover.endDate
                            ? cover.endDate.toISOString().slice(0, 10)
                            : cover.policy.expiryDate.toISOString().slice(0, 10)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {canViewBank ? (
            <BankDetails
              employeeId={employee.id}
              canManage={canManageBank}
              detail={
                bankDetail
                  ? {
                      bankName: bankDetail.bankName,
                      iban: bankDetail.iban,
                      accountNo: bankDetail.accountNo,
                      swift: bankDetail.swift,
                      verifiedAt: bankDetail.verifiedAt
                        ? bankDetail.verifiedAt.toISOString().slice(0, 10)
                        : null,
                    }
                  : null
              }
            />
          ) : null}

          {employee.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{employee.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Employment</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  ["Employee number", employee.employeeNo],
                  ["Company", `${employee.company.code} — ${employee.company.name}`],
                  ["Department", employee.department?.name ?? null],
                  ["Position", employee.position?.title ?? null],
                  [
                    "Reports to",
                    employee.manager
                      ? `${employee.manager.fullName} (${employee.manager.employeeNo})`
                      : null,
                  ],
                  ["Direct reports", employee._count.reports > 0 ? String(employee._count.reports) : null],
                  ["Employment type", titleCase(employee.employmentType)],
                  ["Joining date", formatDate(employee.joiningDate)],
                  ["Last working date", formatDate(employee.lastWorkingDate)],
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identity" className="mt-4">
          <IdentityDocuments
            employeeId={employee.id}
            canEdit={canEdit}
            iqama={
              employee.iqama
                ? {
                    iqamaNumber: employee.iqama.iqamaNumber,
                    profession: employee.iqama.profession,
                    professionAr: employee.iqama.professionAr,
                    issueDate: employee.iqama.issueDate.toISOString().slice(0, 10),
                    expiryDate: employee.iqama.expiryDate.toISOString().slice(0, 10),
                    sponsorName: employee.iqama.sponsorName,
                    notes: employee.iqama.notes,
                  }
                : null
            }
            passport={
              employee.passport
                ? {
                    passportNumber: employee.passport.passportNumber,
                    issueCountry: employee.passport.issueCountry,
                    issuePlace: employee.passport.issuePlace,
                    issueDate: employee.passport.issueDate.toISOString().slice(0, 10),
                    expiryDate: employee.passport.expiryDate.toISOString().slice(0, 10),
                    notes: employee.passport.notes,
                  }
                : null
            }
            iqamaExpiryBadge={
              employee.iqama ? <ExpiryAlert date={employee.iqama.expiryDate} /> : null
            }
            passportExpiryBadge={
              employee.passport ? <ExpiryAlert date={employee.passport.expiryDate} /> : null
            }
          />

          <div className="mt-4">
            <IqamaRenewals
              employeeId={employee.id}
              canEdit={canEdit}
              hasIqama={employee.iqama !== null}
              renewals={renewals.map((r) => ({
                id: r.id,
                previousExpiry: r.previousExpiry.toISOString().slice(0, 10),
                newExpiry: r.newExpiry ? r.newExpiry.toISOString().slice(0, 10) : null,
                submittedAt: r.submittedAt ? r.submittedAt.toISOString().slice(0, 10) : null,
                completedAt: r.completedAt ? r.completedAt.toISOString().slice(0, 10) : null,
                status: r.status,
                notes: r.notes,
              }))}
            />
          </div>
        </TabsContent>

        {canViewDocuments ? (
          <TabsContent value="documents" className="mt-4 space-y-4">
            {canUpload ? (
              <div className="flex justify-end">
                <DocumentUpload
                  entityType="EMPLOYEE"
                  entityId={employee.id}
                  companyId={employee.companyId}
                  documentTypes={types}
                  defaultTitle={`${employee.fullName} — `}
                />
              </div>
            ) : null}
            <DocumentList
              canDelete={ctx.permissions.has("documents.delete")}
              documents={documents.map((d) => ({
                id: d.id,
                title: d.title,
                documentNo: d.documentNo,
                typeName: d.documentType.name,
                issueDate: d.issueDate ? d.issueDate.toISOString().slice(0, 10) : null,
                expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
                fileId: d.fileId,
                originalName: d.file.originalName,
                sizeBytes: d.file.sizeBytes,
                version: d.version,
              }))}
            />
          </TabsContent>
        ) : null}

        {canViewContracts ? (
          <TabsContent value="contracts" className="mt-4 space-y-4">
            {ctx.permissions.has("hr.contracts.manage") ? (
              <div className="flex justify-end">
                <ContractDialog
                  employeeId={employee.id}
                  companyId={employee.companyId}
                  canSeeSalary={ctx.permissions.has("employees.salary.view")}
                />
              </div>
            ) : null}
            {contracts.length === 0 ? (
              <EmptyState
                title="No contracts"
                description="Contracts with an end date feed the expiry alerts automatically."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Employment contracts</caption>
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Start</th>
                      <th className="px-4 py-2 font-medium">End</th>
                      {ctx.permissions.has("employees.salary.view") ? (
                        <th className="px-4 py-2 font-medium">Basic salary</th>
                      ) : null}
                      <th className="px-4 py-2 font-medium">Status</th>
                      {ctx.permissions.has("hr.contracts.manage") ? (
                        <th className="px-4 py-2" />
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-4 py-2">
                          {c.contractType.replace(/_/g, " ").toLowerCase()}
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {c.startDate.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-2">
                          {c.endDate ? (
                            <ExpiryDate date={c.endDate} />
                          ) : (
                            <span className="text-muted-foreground">Open-ended</span>
                          )}
                        </td>
                        {ctx.permissions.has("employees.salary.view") ? (
                          <td className="px-4 py-2 tabular-nums">
                            {c.basicSalary ? `${c.basicSalary.toString()} ${c.currency}` : "—"}
                          </td>
                        ) : null}
                        <td className="px-4 py-2">
                          <StatusBadge status={c.status} />
                        </td>
                        {ctx.permissions.has("hr.contracts.manage") ? (
                          <td className="px-4 py-2 text-right">
                            <ContractDialog
                              employeeId={employee.id}
                              companyId={employee.companyId}
                              canSeeSalary={ctx.permissions.has("employees.salary.view")}
                              contract={{
                                id: c.id,
                                contractType: c.contractType,
                                startDate: c.startDate.toISOString().slice(0, 10),
                                endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
                                probationEndDate: c.probationEndDate
                                  ? c.probationEndDate.toISOString().slice(0, 10)
                                  : null,
                                status: c.status,
                                currency: c.currency,
                                basicSalary: c.basicSalary ? c.basicSalary.toString() : null,
                                housingAllowance: allowanceValue(c.allowances, "housing"),
                                transportAllowance: allowanceValue(c.allowances, "transport"),
                                otherAllowance: allowanceValue(c.allowances, "other"),
                                notes: c.notes,
                              }}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ) : null}

        {canViewLeave ? (
          <TabsContent value="leave" className="mt-4">
            {leave.length === 0 ? (
              <EmptyState
                title="No leave requests"
                description="Requests appear here with their approval status."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Leave history</caption>
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Dates</th>
                      <th className="px-4 py-2 font-medium">Days</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leave.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-4 py-2">{l.leaveType.name}</td>
                        <td className="px-4 py-2 tabular-nums">
                          {l.startDate.toISOString().slice(0, 10)} →{" "}
                          {l.endDate.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-2 tabular-nums">{l.days.toString()}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ) : null}

        {canViewAssets ? (
          <TabsContent value="assets" className="mt-4">
            {assets.length === 0 ? (
              <EmptyState
                title="No assets issued"
                description="Assets issued to this employee appear here, and block offboarding until returned."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">IT assets issued to this employee</caption>
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Asset</th>
                      <th className="px-4 py-2 font-medium">Issued</th>
                      <th className="px-4 py-2 font-medium">Returned</th>
                      <th className="px-4 py-2 font-medium">Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-2">
                          <Link
                            href={`/it/assets/${a.asset.id}`}
                            className="font-medium hover:underline"
                          >
                            {a.asset.brand} {a.asset.model}
                          </Link>
                          <p className="text-muted-foreground font-mono text-xs">
                            {a.asset.assetCode}
                          </p>
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {a.assignedAt.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-2">
                          {a.returnedAt ? (
                            <span className="tabular-nums">
                              {a.returnedAt.toISOString().slice(0, 10)}
                            </span>
                          ) : (
                            <Badge variant="info">Still held</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          out {a.conditionOut.toLowerCase()}
                          {a.conditionIn ? ` · in ${a.conditionIn.toLowerCase()}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ) : null}

        {canViewTimesheet && timesheet ? (
          <TabsContent value="timesheet" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat label="Days recorded" value={String(timesheet.summary.daysRecorded)} />
              <MiniStat label="Approved hours" value={String(timesheet.summary.normalHours)} />
              <MiniStat label="Overtime" value={String(timesheet.summary.overtimeHours)} />
              <MiniStat
                label="Delayed"
                value={String(timesheet.summary.delayedHours)}
                tone={timesheet.summary.delayedHours > 0 ? "warning" : "neutral"}
              />
            </div>

            {timesheet.entries.length === 0 ? (
              <EmptyState
                title="No timesheet entries"
                description="Hours recorded for this employee will appear here."
              />
            ) : (
              <TabTable head={["Date", "Normal", "Overtime", "Delayed", "Status"]}>
                {timesheet.entries.slice(0, 60).map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">{e.date.toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2 tabular-nums">{e.normalHours.toString()}</td>
                    <td className="px-3 py-2 tabular-nums">{e.overtimeHours.toString()}</td>
                    <td className="px-3 py-2 tabular-nums">{e.delayedHours.toString()}</td>
                    <td className="px-3 py-2">
                      {e.absent ? <Badge variant="outline">Absent</Badge> : null}
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewEvaluations ? (
          <TabsContent value="evaluations" className="mt-4">
            {evaluations.length === 0 ? (
              <EmptyState
                title="No evaluations"
                description="Performance reviews for this employee will appear here."
              />
            ) : (
              <TabTable head={["Period", "Score", "Summary", "Status"]}>
                {evaluations.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.periodStart.toISOString().slice(0, 10)} →{" "}
                      {e.periodEnd.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {e.overallScore === null ? "—" : e.overallScore.toString()}
                    </td>
                    <td className="text-muted-foreground max-w-md px-3 py-2">
                      {e.summary ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewWarnings ? (
          <TabsContent value="warnings" className="mt-4">
            {warnings.length === 0 ? (
              <EmptyState
                title="No warning letters"
                description="Disciplinary letters issued to this employee will appear here."
              />
            ) : (
              <TabTable head={["Issued", "Level", "Reason", "Acknowledged"]}>
                {warnings.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {w.issuedDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={w.level} />
                    </td>
                    <td className="max-w-md px-3 py-2">{w.reason}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {w.acknowledgedAt
                        ? w.acknowledgedAt.toISOString().slice(0, 10)
                        : "Not acknowledged"}
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewIncrements ? (
          <TabsContent value="increments" className="mt-4 space-y-3">
            {/*
              The service returns figures as null unless the actor holds
              employees.salary.view, so an increments viewer without it sees
              that a rise happened and when, but not for how much. The note
              below explains the dashes rather than leaving them unexplained.
            */}
            {!canSeeSalaryFigures ? (
              <p className="text-muted-foreground text-xs">
                Amounts are hidden — viewing salary figures is a separate permission.
              </p>
            ) : null}

            {increments.length === 0 ? (
              <EmptyState
                title="No increments"
                description="Salary increases for this employee will appear here."
              />
            ) : (
              <TabTable head={["Effective", "From", "To", "Increase", "Status"]}>
                {increments.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {i.effectiveDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {i.currentSalary === null ? "—" : `${i.currentSalary} ${i.currency}`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {i.newSalary === null ? "—" : `${i.newSalary} ${i.currency}`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {i.amount === null ? "—" : `${i.amount} (${i.percentage ?? "—"}%)`}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={i.status} />
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewAccommodation ? (
          <TabsContent value="accommodation" className="mt-4">
            {accommodation.length === 0 ? (
              <EmptyState
                title="Not housed"
                description="Company accommodation assigned to this employee will appear here."
              />
            ) : (
              <TabTable head={["Accommodation", "Room / bed", "Checked in", "Checked out"]}>
                {accommodation.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/accommodation/${a.bed.room.accommodation.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.bed.room.accommodation.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {a.bed.room.accommodation.city ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {a.bed.room.roomNumber} · {a.bed.bedLabel}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {a.checkInDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {a.checkOutDate ? (
                        a.checkOutDate.toISOString().slice(0, 10)
                      ) : (
                        <Badge>Current</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewChecklists ? (
          <>
            <TabsContent value="onboarding" className="mt-4">
              <ChecklistTable
                rows={onboarding}
                emptyTitle="No onboarding checklist"
                emptyDescription="Start an onboarding checklist to track this employee's joining steps."
              />
            </TabsContent>

            <TabsContent value="offboarding" className="mt-4">
              <ChecklistTable
                rows={offboarding}
                emptyTitle="No offboarding checklist"
                emptyDescription="Clearance and exit steps appear here once offboarding starts."
              />
            </TabsContent>
          </>
        ) : null}

        {canViewTasks ? (
          <TabsContent value="tasks" className="mt-4">
            {employeeTasks.length === 0 ? (
              <EmptyState
                title="No tasks"
                description="Tasks raised against this employee will appear here."
              />
            ) : (
              <TabTable head={["Task", "Title", "Priority", "Due", "Status"]}>
                {employeeTasks.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/tasks/${t.id}`} className="hover:underline">
                        {t.taskNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{t.title}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.priority} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewCorrespondence ? (
          <TabsContent value="correspondence" className="mt-4">
            {correspondence.length === 0 ? (
              <EmptyState
                title="No correspondence"
                description="Letters to and from government bodies about this employee will appear here."
              />
            ) : (
              <TabTable head={["Sent", "Type", "Subject", "Recipient", "Status"]}>
                {correspondence.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.sentDate ? c.sentDate.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2">{c.type.replace(/_/g, " ")}</td>
                    <td className="max-w-md px-3 py-2">{c.subject}</td>
                    <td className="text-muted-foreground px-3 py-2">{c.recipient}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewAudit && auditHistory ? (
          <TabsContent value="audit" className="mt-4 space-y-3">
            {auditHistory.entries.length === 0 ? (
              <EmptyState
                title="No history yet"
                description="Every change to this employee record is recorded here."
              />
            ) : (
              <>
                <ul className="space-y-2">
                  {auditHistory.entries.map((entry) => (
                    <li key={entry.id} className="rounded-lg border px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{entry.actorLabel}</span>
                        <span className="text-muted-foreground text-xs">
                          {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                      <AuditChanges summary={entry.summary} changes={entry.changes} />
                    </li>
                  ))}
                </ul>
                {auditHistory.total > auditHistory.entries.length ? (
                  <Link
                    href={`/audit?entityType=EMPLOYEE&entityId=${employee.id}`}
                    className="text-muted-foreground text-xs underline-offset-4 hover:underline"
                  >
                    Showing {auditHistory.entries.length} of {auditHistory.total} — open the full
                    audit log
                  </Link>
                ) : null}
              </>
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </PageShell>
  );
}

function DetailList({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="truncate text-sm">
            {value ? value : <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}


/** One compact figure, used by the timesheet tab. */
function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="gap-0 py-3">
      <CardContent className="px-3">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={`text-lg font-semibold tabular-nums${
            tone === "warning" ? " text-status-warning" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/** The table chrome every profile tab shares, so no tab invents its own. */
function TabTable({
  head,
  children,
}: {
  head: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Onboarding and offboarding render identically; only the copy differs. */
function ChecklistTable({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: {
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    template: { name: string };
    items: { status: string }[];
  }[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <TabTable head={["Checklist", "Progress", "Started", "Completed", "Status"]}>
      {rows.map((c) => {
        const done = c.items.filter(
          (i) => i.status === "COMPLETED" || i.status === "NOT_APPLICABLE",
        ).length;
        return (
          <tr key={c.id} className="border-t">
            <td className="px-3 py-2">
              <Link
                href={`/people/checklists/${c.id}`}
                className="font-medium hover:underline"
              >
                {c.template.name}
              </Link>
            </td>
            <td className="px-3 py-2 tabular-nums">
              {done} / {c.items.length}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              {c.startedAt.toISOString().slice(0, 10)}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              {c.completedAt ? c.completedAt.toISOString().slice(0, 10) : "—"}
            </td>
            <td className="px-3 py-2">
              <StatusBadge status={c.status} />
            </td>
          </tr>
        );
      })}
    </TabTable>
  );
}
