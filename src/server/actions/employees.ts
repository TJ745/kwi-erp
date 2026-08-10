"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  employeeSchema,
  employeeStatusSchema,
  iqamaSchema,
  passportSchema,
  updateEmployeeSchema,
} from "@/lib/schemas/employee";
import {
  createEmployee,
  setEmployeeStatus,
  updateEmployee,
  upsertIqama,
  upsertPassport,
} from "@/server/services/employees";

export const createEmployeeAction = defineAction({
  permission: "employees.create",
  schema: employeeSchema,
  audit: { action: "CREATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const employee = await createEmployee(ctx, input);
    audit.record({
      entityId: employee.id,
      companyId: employee.companyId,
      summary: `Created employee ${employee.employeeNo} — ${employee.fullName}`,
      after: { employeeNo: employee.employeeNo, fullName: employee.fullName },
    });
    return { id: employee.id, employeeNo: employee.employeeNo };
  },
  revalidate: () => ["/people/employees"],
});

export const updateEmployeeAction = defineAction({
  permission: "employees.update",
  schema: updateEmployeeSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateEmployee(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated employee ${after.employeeNo} — ${after.fullName}`,
      before: {
        fullName: before.fullName,
        status: before.status,
        departmentId: before.departmentId,
        positionId: before.positionId,
        managerId: before.managerId,
        mobile: before.mobile,
        workEmail: before.workEmail,
      },
      after: {
        fullName: after.fullName,
        status: after.status,
        departmentId: after.departmentId,
        positionId: after.positionId,
        managerId: after.managerId,
        mobile: after.mobile,
        workEmail: after.workEmail,
      },
    });
    return { id: after.id };
  },
  revalidate: (input) => ["/people/employees", `/people/employees/${input.id}`],
});

export const setEmployeeStatusAction = defineAction({
  permission: "employees.update",
  schema: employeeStatusSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await setEmployeeStatus(ctx, {
      id: input.id,
      status: input.status,
      lastWorkingDate: input.lastWorkingDate,
    });
    audit.record({
      entityId: input.id,
      summary: `Changed status of ${result.employee.fullName} from ${result.before.status} to ${result.after.status}${
        input.reason ? ` (${input.reason})` : ""
      }`,
      before: result.before,
      after: result.after,
    });
    return { ok: true as const };
  },
  revalidate: (input) => ["/people/employees", `/people/employees/${input.id}`],
});

export const upsertIqamaAction = defineAction({
  permission: "employees.update",
  schema: iqamaSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const record = await upsertIqama(ctx, input);
    audit.record({
      entityId: input.employeeId,
      // The number itself is deliberately not in the summary — it is a national
      // identifier, and the audit trail is widely readable.
      summary: `Updated Iqama record (expires ${record.expiryDate.toISOString().slice(0, 10)})`,
      after: { expiryDate: record.expiryDate, profession: record.profession },
    });
    return { ok: true as const };
  },
  revalidate: (input) => [
    `/people/employees/${input.employeeId}`,
    "/people/iqama",
    "/dashboard",
  ],
});

export const upsertPassportAction = defineAction({
  permission: "employees.update",
  schema: passportSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const record = await upsertPassport(ctx, input);
    audit.record({
      entityId: input.employeeId,
      summary: `Updated passport record (expires ${record.expiryDate.toISOString().slice(0, 10)})`,
      after: { expiryDate: record.expiryDate, issueCountry: record.issueCountry },
    });
    return { ok: true as const };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`, "/dashboard"],
});

/** Manager options for the employee form; scoped to the selected company. */
export const managerOptionsAction = defineAction({
  permission: "employees.view",
  schema: z.object({ companyId: z.string().min(1), excludeId: z.string().optional() }).strict(),
  handler: async ({ input, ctx }) => {
    const { managerOptions } = await import("@/server/services/employees");
    return managerOptions(ctx, input.companyId, input.excludeId);
  },
});
