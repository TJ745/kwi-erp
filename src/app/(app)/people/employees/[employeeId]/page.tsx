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
import { leaveForEmployee } from "@/server/services/leave";
import { DocumentList } from "./document-list";
import { IdentityDocuments } from "./identity-documents";

export const metadata: Metadata = { title: "Employee" };

/**
 * Employee profile.
 *
 * The brief lists 18 tabs; the ones whose modules exist are live, and the rest
 * state plainly which phase brings them. That is more honest than rendering
 * empty panels that look broken.
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

  const [documents, types, contracts, leave, assets] = await Promise.all([
    canViewDocuments
      ? documentsForEntity(ctx, "EMPLOYEE", employee.id)
      : Promise.resolve([]),
    canViewDocuments && canUpload ? documentTypes() : Promise.resolve([]),
    canViewContracts ? contractsForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewLeave ? leaveForEmployee(ctx, employee.id) : Promise.resolve([]),
    canViewAssets ? assetsForEmployee(ctx, employee.id) : Promise.resolve([]),
  ]);

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
              <Link
                href={`/people/employees/${employee.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil />
                Edit
              </Link>
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
            <TabsTrigger value="pending">Other tabs</TabsTrigger>
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

        <TabsContent value="pending" className="mt-4">
          <EmptyState
            title="Remaining tabs arrive with their modules"
            description="Timesheet, Evaluation, Warnings, Increment, Accommodation, Onboarding, Offboarding, Tasks, Correspondence, and Audit History are built in later phases. Each appears here as its module lands."
          />
        </TabsContent>
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
