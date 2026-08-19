"use server";

import { defineAction } from "./define-action";
import {
  companyBrandingSchema,
  companySchema,
  departmentSchema,
  positionSchema,
  updateCompanySchema,
  updateDepartmentSchema,
  updatePositionSchema,
} from "@/lib/schemas/org";
import {
  createCompany,
  setCompanyBranding,
  createDepartment,
  createPosition,
  updateCompany,
  updateDepartment,
  updatePosition,
} from "@/server/services/org";

export const createCompanyAction = defineAction({
  permission: "companies.manage",
  schema: companySchema,
  audit: { action: "CREATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const company = await createCompany(ctx, input);
    audit.record({
      entityId: company.id,
      companyId: company.id,
      summary: `Created company ${company.code} — ${company.name}`,
      after: { code: company.code, name: company.name },
    });
    return { id: company.id };
  },
  revalidate: () => ["/settings/companies"],
});

export const updateCompanyAction = defineAction({
  permission: "companies.manage",
  schema: updateCompanySchema,
  audit: { action: "UPDATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateCompany(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.id,
      summary: `Updated company ${after.code}`,
      before: { code: before.code, name: before.name, status: before.status },
      after: { code: after.code, name: after.name, status: after.status },
    });
    return { id: after.id };
  },
  revalidate: () => ["/settings/companies"],
});

export const setCompanyBrandingAction = defineAction({
  permission: "companies.manage",
  schema: companyBrandingSchema,
  audit: { action: "UPDATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const { company, before } = await setCompanyBranding(ctx, input);
    const slot = input.slot === "HEADER" ? "header" : "footer";
    audit.record({
      entityId: company.id,
      companyId: company.id,
      summary:
        input.fileId === null
          ? `Removed the document ${slot} image for ${company.code}`
          : `Set the document ${slot} image for ${company.code}`,
      before: { [`${slot}ImageFileId`]: before },
      after: { [`${slot}ImageFileId`]: input.fileId },
    });
    return { ok: true };
  },
  revalidate: () => ["/settings/companies"],
});

export const createDepartmentAction = defineAction({
  permission: "departments.manage",
  schema: departmentSchema,
  audit: { action: "CREATE", entity: "DEPARTMENT" },
  handler: async ({ input, ctx, audit }) => {
    const department = await createDepartment(ctx, input);
    audit.record({
      entityId: department.id,
      companyId: department.companyId,
      summary: `Created department ${department.code} — ${department.name}`,
      after: { code: department.code, name: department.name },
    });
    return { id: department.id };
  },
  revalidate: () => ["/settings/departments"],
});

export const updateDepartmentAction = defineAction({
  permission: "departments.manage",
  schema: updateDepartmentSchema,
  audit: { action: "UPDATE", entity: "DEPARTMENT" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateDepartment(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated department ${after.code}`,
      before: { code: before.code, name: before.name, parentId: before.parentId },
      after: { code: after.code, name: after.name, parentId: after.parentId },
    });
    return { id: after.id };
  },
  revalidate: () => ["/settings/departments"],
});

export const createPositionAction = defineAction({
  permission: "positions.manage",
  schema: positionSchema,
  audit: { action: "CREATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const position = await createPosition(ctx, input);
    audit.record({
      entityId: position.id,
      companyId: position.companyId,
      summary: `Created position "${position.title}"`,
      after: { title: position.title },
    });
    return { id: position.id };
  },
  revalidate: () => ["/settings/departments"],
});

export const updatePositionAction = defineAction({
  permission: "positions.manage",
  schema: updatePositionSchema,
  audit: { action: "UPDATE", entity: "COMPANY" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updatePosition(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated position "${after.title}"`,
      before: { title: before.title, status: before.status },
      after: { title: after.title, status: after.status },
    });
    return { id: after.id };
  },
  revalidate: () => ["/settings/departments"],
});
