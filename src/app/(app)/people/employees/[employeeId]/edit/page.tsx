import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getEmployee, managerOptions } from "@/server/services/employees";
import { orgOptions } from "@/server/services/org";
import { EmployeeForm } from "../../employee-form";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const ctx = await requirePagePermission("employees.update");
  const { employeeId } = await params;

  const [employee, options] = await Promise.all([getEmployee(ctx, employeeId), orgOptions(ctx)]);

  // Exclude self so an employee cannot be set as their own manager.
  const candidates = await managerOptions(ctx, employee.companyId, employee.id);
  // The current manager must be on the list whatever their company or status:
  // the field shows them by this list, and an unlabelled value was being
  // posted as blank — which cleared "Reports to" on every save.
  const current = employee.manager;
  const managers =
    current && !candidates.some((m) => m.id === current.id)
      ? [...candidates, { ...current, companyCode: "" }]
      : candidates;

  return (
    <PageShell>
      <Link
        href={`/people/employees/${employee.id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to {employee.fullName}
      </Link>

      <PageHeader title="Edit employee" description={employee.employeeNo} />

      <EmployeeForm
        mode="edit"
        options={{ ...options, managers }}
        values={{
          id: employee.id,
          employeeNo: employee.employeeNo,
          companyId: employee.companyId,
          departmentId: employee.departmentId,
          positionId: employee.positionId,
          managerId: employee.managerId,
          firstName: employee.firstName,
          middleName: employee.middleName ?? "",
          familyName: employee.familyName ?? "",
          lastName: employee.lastName,
          fullNameAr: employee.fullNameAr,
          gender: employee.gender,
          dateOfBirth: employee.dateOfBirth,
          nationality: employee.nationality,
          maritalStatus: employee.maritalStatus,
          status: employee.status,
          employmentType: employee.employmentType,
          joiningDate: employee.joiningDate,
          lastWorkingDate: employee.lastWorkingDate,
          mobile: employee.mobile,
          workEmail: employee.workEmail,
          personalEmail: employee.personalEmail,
          notes: employee.notes,
          saudiAddressEn: employee.saudiAddressEn,
          saudiAddressAr: employee.saudiAddressAr,
          homeAddressEn: employee.homeAddressEn,
          homeAddressAr: employee.homeAddressAr,
          homePhone: employee.homePhone,
          contractYears: employee.contractYears,
          probationDays: employee.probationDays,
          familyStatus: employee.familyStatus,
          leavePlan: employee.leavePlan,
          ticketDestination: employee.ticketDestination,
          ticketCover: employee.ticketCover,
          medicalCover: employee.medicalCover,
        }}
      />
    </PageShell>
  );
}
