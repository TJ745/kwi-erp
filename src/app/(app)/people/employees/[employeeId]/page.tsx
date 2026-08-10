import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpiryAlert } from "@/components/shared/expiry-alert";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { DocumentUpload } from "@/components/forms/document-upload";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getEmployee } from "@/server/services/employees";
import { documentsForEntity, documentTypes } from "@/server/services/documents";
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

  const [documents, types] = canViewDocuments
    ? await Promise.all([
        documentsForEntity(ctx, "EMPLOYEE", employee.id),
        canUpload ? documentTypes() : Promise.resolve([]),
      ])
    : [[], []];

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

        <TabsContent value="pending" className="mt-4">
          <EmptyState
            title="Remaining tabs arrive with their modules"
            description="Contracts, Leave, Timesheet, Evaluation, Warnings, Increment, IT Assets, Accommodation, Onboarding, Offboarding, Tasks, Correspondence, and Audit History are built in Phases 6–7. Each appears here as its module lands."
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
