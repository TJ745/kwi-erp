import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { documentsForEntity, documentTypesFor } from "@/server/services/documents";
import { assetsForEmployee } from "@/server/services/assets";
import { contractsForEmployee } from "@/server/services/contracts";
import { EmployeeStatusDialog } from "./status-dialog";
import { leaveForEmployee } from "@/server/services/leave";
import {
  lettersForEmployee,
  listWarnings,
  offersForEmployee,
  vehiclesForEmployee,
} from "@/server/services/hr-records";
import { listClearanceForms, listJoiningLetters } from "@/server/services/recruitment";
import { evaluationsForEmployee } from "@/server/services/evaluations";
import { incrementLinesForEmployee, salaryFor } from "@/server/services/increments";
import { formatAmount } from "@/lib/increments";
import { accommodationForEmployee } from "@/server/services/accommodation";
import { listAuditEntries } from "@/server/services/platform";
import { enrolmentsForEmployee } from "@/server/services/insurance";
import { bankDetailFor, iqamaRenewals, listEmergencyContacts } from "@/server/services/employees";
import { AuditChanges } from "@/app/(app)/audit/audit-changes";
import { DocumentList } from "./document-list";
import { IdentityDocuments } from "./identity-documents";
import { IqamaRenewals } from "./iqama-renewals";
import { SalaryCard } from "./salary-card";
import { EmergencyContacts } from "./emergency-contacts";
import { TERM_OPTION_LABELS } from "@/lib/job-offer";
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
  const canViewEvaluations = ctx.permissions.has("hr.evaluations.view");
  const canViewWarnings = ctx.permissions.has("hr.warnings.view");
  // Joining letters and clearance forms are HR records about the employee.
  const canViewHrForms = ctx.permissions.has("hr.view");
  const canViewOffers = ctx.permissions.has("hr.offers.view");
  const canViewLetters = ctx.permissions.has("letters.view");
  const canViewVehicles = ctx.permissions.has("vehicles.view");
  const canViewIncrements = ctx.permissions.has("hr.increments.view");
  const canViewAccommodation = ctx.permissions.has("accommodation.view");
  const canViewAudit = ctx.permissions.has("audit.view");
  const canSeeSalaryFigures = ctx.permissions.has("employees.salary.view");
  // Bank details are their own sensitive surface: the query does not run at all
  // without the permission, so an IBAN never reaches the payload uninvited.
  const canViewBank = ctx.permissions.has("employees.bank.view");
  const canViewInsurance = ctx.permissions.has("insurance.view");
  const canManageBank = ctx.permissions.has("employees.bank.manage");
  const canManageSalary = canSeeSalaryFigures && ctx.permissions.has("employees.salary.manage");

  const [
    documents,
    types,
    contracts,
    leave,
    assets,
    evaluations,
    warnings,
    increments,
    accommodation,
    auditHistory,
    renewals,
    emergencyContacts,
    bankDetail,
    insurance,
    salary,
    joiningLetters,
    clearanceForms,
    offers,
    letters,
    vehicles,
  ] = await Promise.all([
    canViewDocuments ? documentsForEntity(ctx, "EMPLOYEE", employee.id) : Promise.resolve([]),
    canViewDocuments && canUpload ? documentTypesFor("EMPLOYEE") : Promise.resolve([]),
    canViewContracts ? contractsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewLeave ? leaveForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewAssets ? assetsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewEvaluations ? evaluationsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewWarnings ? listWarnings(ctx, { employeeId: employee.id }) : Promise.resolve([]),
    canViewIncrements && canSeeSalaryFigures
      ? incrementLinesForEmployee(ctx, employee.id).then((r) => r ?? [])
      : Promise.resolve([]),
    canViewAccommodation ? accommodationForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewAudit
      ? listAuditEntries(ctx, { entityType: "EMPLOYEE", entityId: employee.id })
      : Promise.resolve(null),
    iqamaRenewals(ctx, employee.id),
    listEmergencyContacts(ctx, employee.id),
    canViewBank ? bankDetailFor(ctx, employee.id) : Promise.resolve(null),
    canViewInsurance ? enrolmentsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canSeeSalaryFigures ? salaryFor(ctx, employee.id) : Promise.resolve(null),
    canViewHrForms ? listJoiningLetters(ctx, { employeeId: employee.id }) : Promise.resolve([]),
    canViewHrForms ? listClearanceForms(ctx, { employeeId: employee.id }) : Promise.resolve([]),
    canViewOffers ? offersForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewLetters ? lettersForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewVehicles
      ? vehiclesForEmployee(ctx, employee.id)
      : Promise.resolve({ assignments: [], handovers: [] }),
  ]);
  const hrFormCount =
    joiningLetters.length + clearanceForms.length + offers.length + letters.length;
  const showForms = canViewHrForms || canViewOffers || canViewLetters;
  const vehicleCount = vehicles.assignments.length;

  // Only currently-held assets matter here; history is on the asset.
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
            {showForms ? (
              <TabsTrigger value="hr-forms">
                Letters &amp; Forms{hrFormCount > 0 ? ` (${String(hrFormCount)})` : ""}
              </TabsTrigger>
            ) : null}
            {canViewVehicles ? (
              <TabsTrigger value="vehicles">
                Vehicles{vehicleCount > 0 ? ` (${String(vehicleCount)})` : ""}
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
                    [
                      "Marital status",
                      employee.maritalStatus ? titleCase(employee.maritalStatus) : null,
                    ],
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
                    ["Home country phone", employee.homePhone],
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

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Addresses</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    ["Address in KSA", employee.saudiAddressEn],
                    ["Address in KSA (Arabic)", employee.saudiAddressAr],
                    ["Home country address", employee.homeAddressEn],
                    ["Home country address (Arabic)", employee.homeAddressAr],
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Terms of employment</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList items={termsList(employee)} />
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

          {salary ? (
            <SalaryCard employeeId={employee.id} salary={salary} canManage={canManageSalary} />
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
                  [
                    "Direct reports",
                    employee._count.reports > 0 ? String(employee._count.reports) : null,
                  ],
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
                    issueDate: employee.iqama.issueDate?.toISOString().slice(0, 10) ?? null,
                    expiryDate: employee.iqama.expiryDate?.toISOString().slice(0, 10) ?? null,
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
                    issueDate: employee.passport.issueDate?.toISOString().slice(0, 10) ?? null,
                    expiryDate: employee.passport.expiryDate?.toISOString().slice(0, 10) ?? null,
                    notes: employee.passport.notes,
                  }
                : null
            }
            iqamaExpiryBadge={
              employee.iqama?.expiryDate ? <ExpiryAlert date={employee.iqama.expiryDate} /> : null
            }
            passportExpiryBadge={
              employee.passport?.expiryDate ? <ExpiryAlert date={employee.passport.expiryDate} /> : null
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
            {contracts.length === 0 ? (
              <EmptyState
                title="No contracts"
                description="Contracts are added from HR → Contracts and show here."
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
                      <th className="px-4 py-2" />
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
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {/* The printed contract states the salary. */}
                          {canSeeSalaryFigures ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/hr/contracts/${c.id}`} target="_blank" rel="noopener">
                                <Printer />
                                Print
                              </Link>
                            </Button>
                          ) : null}
                        </td>
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
                title="No leave"
                description="Leave recorded in People → Leave appears here."
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
                      <th className="px-4 py-2" />
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
                        <td className="px-4 py-2 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/people/leave/${l.id}`} target="_blank" rel="noopener">
                              <Printer />
                              Print
                            </Link>
                          </Button>
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
                description="Assets issued to this employee appear here."
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

        {canViewEvaluations ? (
          <TabsContent value="evaluations" className="mt-4">
            {evaluations.length === 0 ? (
              <EmptyState
                title="No evaluations"
                description="Performance reviews for this employee will appear here."
              />
            ) : (
              <TabTable head={["Date", "List", "Form", "Result", ""]}>
                {evaluations.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.evaluationDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/hr/evaluations/${e.list.id}/${e.id}`}
                        className="hover:underline"
                      >
                        {e.list.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{e.template === "STAFF" ? "Staff" : "Worker"}</td>
                    <td className="px-3 py-2 tabular-nums">{e.outcome ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/evaluations/${e.list.id}/${e.id}/print`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewVehicles ? (
          <TabsContent value="vehicles" className="mt-4 space-y-4">
            {vehicles.assignments.length === 0 && vehicles.handovers.length === 0 ? (
              <EmptyState
                title="No vehicles"
                description="Vehicles this employee drives or has driven appear here."
              />
            ) : (
              <>
                {vehicles.assignments.length > 0 ? (
                  <TabTable head={["Vehicle", "From", "Until", ""]}>
                    {vehicles.assignments.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-3 py-2">
                          <Link href={`/vehicles/${a.vehicle.id}`} className="hover:underline">
                            {a.vehicle.plateNumber}
                          </Link>
                          <span className="text-muted-foreground ml-1 text-xs">
                            {a.vehicle.make} {a.vehicle.model}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {a.assignedAt.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {a.unassignedAt ? a.unassignedAt.toISOString().slice(0, 10) : "Current"}
                        </td>
                        <td className="px-3 py-2" />
                      </tr>
                    ))}
                  </TabTable>
                ) : null}
                {vehicles.handovers.length > 0 ? (
                  <TabTable head={["Handover", "Date", "Between", ""]}>
                    {vehicles.handovers.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="px-3 py-2">{h.vehicle.plateNumber}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {h.handoverDate.toISOString().slice(0, 10)}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {h.fromEmployee?.fullName ?? "Pool"} → {h.toEmployee?.fullName ?? "Pool"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/vehicles/handovers/${h.id}`} target="_blank" rel="noopener">
                              <Printer />
                              Print
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </TabTable>
                ) : null}
              </>
            )}
          </TabsContent>
        ) : null}

        {showForms ? (
          <TabsContent value="hr-forms" className="mt-4">
            {hrFormCount === 0 ? (
              <EmptyState
                title="No letters or forms"
                description="Job offers, joining letters, clearance forms and Letters & Memos for this employee show here."
              />
            ) : (
              <TabTable head={["Form", "Date", "Details", ""]}>
                {offers.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2">Job offer</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(o.offerDate ?? o.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {o.refNo ?? ""} · {o.status.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canSeeSalaryFigures ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/hr/offers/${o.id}`} target="_blank" rel="noopener">
                            <Printer />
                            Print
                          </Link>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {joiningLetters.map((j) => (
                  <tr key={j.id} className="border-t">
                    <td className="px-3 py-2">Joining letter</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {j.letterDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      Joined {j.joiningDate.toISOString().slice(0, 10)}
                      {j.positionTitle ? ` · ${j.positionTitle}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/joining-letters/${j.id}`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {clearanceForms.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">Clearance form</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.formDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {c.endDate ? `Last day ${c.endDate.toISOString().slice(0, 10)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/clearance/${c.id}`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {letters.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2">{l.template.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.generatedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {l.letterNo} · {l.status.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/letters/${l.id}`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
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
              <TabTable head={["Issued", "Level", "Reason", ""]}>
                {warnings.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {w.issuedDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={w.level} />
                    </td>
                    <td className="max-w-md px-3 py-2">{w.reason}</td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hr/warnings/${w.id}`} target="_blank" rel="noopener">
                          <Printer />
                          Print
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </TabTable>
            )}
          </TabsContent>
        ) : null}

        {canViewIncrements ? (
          <TabsContent value="increments" className="mt-4 space-y-3">
            {!canSeeSalaryFigures ? (
              <p className="text-muted-foreground text-xs">
                Increment lists are hidden — viewing salary figures is a separate permission.
              </p>
            ) : increments.length === 0 ? (
              <EmptyState
                title="Not on any increment list"
                description="Increment lists this employee is added to will appear here."
              />
            ) : (
              <TabTable head={["Date", "List", "Current", "Demanded", "Proposed", "New salary"]}>
                {increments.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {i.list.listDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/hr/increments/${i.list.id}`} className="hover:underline">
                        {i.list.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatAmount(i.currentTotal)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatAmount(i.demandedIncrement)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatAmount(i.proposedIncrement)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatAmount(i.proposedTotal)}</td>
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

function termsList(e: {
  contractYears: number | null;
  probationDays: number | null;
  familyStatus: string | null;
  leavePlan: string | null;
  ticketDestination: string | null;
  ticketCover: string | null;
  medicalCover: string | null;
}): [string, string | null][] {
  const L = TERM_OPTION_LABELS;
  const pick = (labels: Record<string, string>, v: string | number | null) =>
    v === null ? null : (labels[String(v)] ?? String(v));
  return [
    ["Contract duration", pick(L.contractYears, e.contractYears)],
    ["Probation", pick(L.probationDays, e.probationDays)],
    ["Family status", pick(L.familyStatus, e.familyStatus)],
    ["Leave entitlement", pick(L.leavePlan, e.leavePlan)],
    ["Ticket destination", e.ticketDestination],
    ["Ticket cover", pick(L.cover, e.ticketCover)],
    ["Medical cover", pick(L.cover, e.medicalCover)],
  ];
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

/** The table chrome every profile tab shares, so no tab invents its own. */
function TabTable({ head, children }: { head: readonly string[]; children: React.ReactNode }) {
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
