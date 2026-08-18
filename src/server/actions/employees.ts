"use server";

import { z } from "zod";
import { maskIban } from "@/lib/bank";
import { defineAction } from "./define-action";
import {
  employeeSchema,
  employeeStatusSchema,
  bankDetailIdSchema,
  bankDetailSchema,
  emergencyContactIdSchema,
  emergencyContactSchema,
  iqamaSchema,
  startIqamaRenewalSchema,
  updateEmergencyContactSchema,
  updateIqamaRenewalSchema,
  passportSchema,
  updateEmployeeSchema,
} from "@/lib/schemas/employee";
import {
  createEmployee,
  setEmployeeStatus,
  updateEmployee,
  createEmergencyContact,
  deleteBankDetail,
  upsertBankDetail,
  deleteEmergencyContact,
  startIqamaRenewal,
  updateEmergencyContact,
  updateIqamaRenewal,
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
  schema: z
    .object({
      companyId: z.string().min(1),
      excludeId: z.string().optional(),
      q: z.string().max(100).optional(),
    })
    .strict(),
  handler: async ({ input, ctx }) => {
    const { managerOptions } = await import("@/server/services/employees");
    return managerOptions(ctx, input.companyId, input.excludeId, input.q);
  },
});

// --- Iqama renewals ----------------------------------------------------------

export const startIqamaRenewalAction = defineAction({
  permission: "employees.update",
  schema: startIqamaRenewalSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { renewal, employee } = await startIqamaRenewal(ctx, input);
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      // The Iqama number is never in a summary — it is a national identifier
      // and the audit log is widely readable.
      summary: `Started an Iqama renewal for ${employee.fullName} (current expiry ${renewal.previousExpiry.toISOString().slice(0, 10)})`,
      after: { status: renewal.status },
    });
    return { id: renewal.id };
  },
  revalidate: (input) => [
    `/people/employees/${input.employeeId}`,
    "/people/iqama",
    "/dashboard",
  ],
});

export const updateIqamaRenewalAction = defineAction({
  permission: "employees.update",
  schema: updateIqamaRenewalSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { renewal, employee, previousStatus } = await updateIqamaRenewal(ctx, input);
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      summary:
        input.status === "COMPLETED" && renewal.newExpiry
          ? `Completed the Iqama renewal for ${employee.fullName} — expiry moved to ${renewal.newExpiry.toISOString().slice(0, 10)}`
          : `Iqama renewal for ${employee.fullName} is now ${input.status.replace(/_/g, " ").toLowerCase()}`,
      before: { status: previousStatus },
      after: { status: renewal.status, newExpiry: renewal.newExpiry },
    });
    return { id: renewal.id };
  },
  revalidate: (input) => [
    `/people/employees/${input.employeeId}`,
    "/people/iqama",
    "/dashboard",
  ],
});

// --- Emergency contacts ------------------------------------------------------

export const createEmergencyContactAction = defineAction({
  permission: "employees.update",
  schema: emergencyContactSchema,
  audit: { action: "CREATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { contact, employee } = await createEmergencyContact(ctx, input);
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      // Names the contact and the relationship, never the phone number.
      summary: `Added emergency contact ${contact.name} (${contact.relation}) for ${employee.fullName}`,
      after: { name: contact.name, relation: contact.relation },
    });
    return { id: contact.id };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`],
});

export const updateEmergencyContactAction = defineAction({
  permission: "employees.update",
  schema: updateEmergencyContactSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, employee } = await updateEmergencyContact(ctx, input);
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      summary: `Updated emergency contact ${after.name} for ${employee.fullName}`,
      before: { name: before.name, relation: before.relation },
      after: { name: after.name, relation: after.relation },
    });
    return { id: after.id };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`],
});

export const deleteEmergencyContactAction = defineAction({
  permission: "employees.update",
  schema: emergencyContactIdSchema,
  audit: { action: "DELETE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { contact, employee } = await deleteEmergencyContact(ctx, input);
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      summary: `Removed emergency contact ${contact.name} for ${employee.fullName}`,
    });
    return { id: contact.id };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`],
});

// --- Bank details ------------------------------------------------------------

/**
 * The action requires `employees.bank.manage` and the service checks it again.
 * Belt and braces on a field that decides where somebody's salary lands.
 */
export const upsertBankDetailAction = defineAction({
  permission: "employees.bank.manage",
  schema: bankDetailSchema,
  audit: { action: "UPDATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, employee, ibanChanged, blindWrite } = await upsertBankDetail(
      ctx,
      input,
    );
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      // The IBAN is masked in the summary: the audit log is readable by anyone
      // holding audit.view, which does not imply employees.bank.view.
      summary: `${before ? "Updated" : "Added"} bank details for ${employee.fullName} — ${after.bankName} ${maskIban(after.iban)}${
        ibanChanged ? " (IBAN changed; verification cleared)" : ""
      }${blindWrite ? " — written by someone without permission to read it" : ""}`,
      // `iban` is on the audit redaction list, so the diff records that it
      // changed without recording the value.
      ...(before ? { before: { bankName: before.bankName, iban: before.iban } } : {}),
      after: { bankName: after.bankName, iban: after.iban },
    });
    return { ok: true as const };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`],
});

export const deleteBankDetailAction = defineAction({
  permission: "employees.bank.manage",
  schema: bankDetailIdSchema,
  audit: { action: "DELETE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const { employee, bankName } = await deleteBankDetail(ctx, input.employeeId);
    audit.record({
      entityId: input.employeeId,
      companyId: employee.companyId,
      summary: `Removed bank details (${bankName}) for ${employee.fullName}`,
    });
    return { ok: true as const };
  },
  revalidate: (input) => [`/people/employees/${input.employeeId}`],
});
