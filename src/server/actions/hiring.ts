"use server";

import {
  convertOfferSchema,
  hiringIdSchema,
  jobDescriptionSchema,
  jobOfferSchema,
  updateJobDescriptionSchema,
  updateJobOfferSchema,
} from "@/lib/schemas/hiring";
import { defineAction } from "./define-action";
import {
  convertOffer,
  createJobDescription,
  createJobOffer,
  deleteJobDescription,
  deleteJobOffer,
  updateJobDescription,
  updateJobOffer,
} from "@/server/services/hiring";

const OFFER_PATHS = ["/hr/offers"];
const JD_PATHS = ["/hr/job-descriptions"];

// --- Job descriptions --------------------------------------------------------

export const createJobDescriptionAction = defineAction({
  permission: "hr.manage",
  schema: jobDescriptionSchema,
  audit: { action: "CREATE", entity: "JOB_OFFER" },
  handler: async ({ input, ctx, audit }) => {
    const jd = await createJobDescription(ctx, input);
    audit.record({
      entityId: jd.id,
      ...(jd.companyId ? { companyId: jd.companyId } : {}),
      summary: `Created job description "${jd.title}"`,
      after: { title: jd.title, version: jd.version },
    });
    return { id: jd.id };
  },
  revalidate: () => JD_PATHS,
});

export const updateJobDescriptionAction = defineAction({
  permission: "hr.manage",
  schema: updateJobDescriptionSchema,
  audit: { action: "UPDATE", entity: "JOB_OFFER" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateJobDescription(ctx, input);
    audit.record({
      entityId: after.id,
      ...(after.companyId ? { companyId: after.companyId } : {}),
      summary: `Updated job description "${after.title}" (v${String(before.version)} → v${String(after.version)})`,
      before,
      after,
    });
    return { id: after.id };
  },
  revalidate: () => JD_PATHS,
});

export const deleteJobDescriptionAction = defineAction({
  permission: "hr.manage",
  schema: hiringIdSchema,
  audit: { action: "DELETE", entity: "JOB_OFFER" },
  handler: async ({ input, ctx, audit }) => {
    const jd = await deleteJobDescription(ctx, input.id);
    audit.record({
      entityId: jd.id,
      ...(jd.companyId ? { companyId: jd.companyId } : {}),
      summary: `Deleted job description "${jd.title}"`,
    });
    return { id: jd.id };
  },
  revalidate: () => JD_PATHS,
});

// --- Job offers --------------------------------------------------------------

export const createJobOfferAction = defineAction({
  permission: "hr.offers.manage",
  schema: jobOfferSchema,
  audit: { action: "CREATE", entity: "JOB_OFFER" },
  handler: async ({ input, ctx, audit }) => {
    const offer = await createJobOffer(ctx, input);
    audit.record({
      entityId: offer.id,
      companyId: offer.companyId,
      summary: `Created offer for ${offer.candidateName}`,
      after: { candidateName: offer.candidateName, status: offer.status },
    });
    return { id: offer.id };
  },
  revalidate: () => OFFER_PATHS,
});

export const updateJobOfferAction = defineAction({
  permission: "hr.offers.manage",
  schema: updateJobOfferSchema,
  audit: { action: "UPDATE", entity: "JOB_OFFER" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateJobOffer(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated offer for ${after.candidateName} — ${before.status} → ${after.status}`,
      before: { status: before.status },
      after: { status: after.status },
    });
    return { id: after.id };
  },
  revalidate: () => OFFER_PATHS,
});

/**
 * Conversion creates a person, so it audits as the employee creation it is —
 * the offer's own row is referenced in the summary rather than being the
 * subject.
 */
export const convertOfferAction = defineAction({
  permission: "employees.create",
  schema: convertOfferSchema,
  audit: { action: "CREATE", entity: "EMPLOYEE" },
  handler: async ({ input, ctx, audit }) => {
    const result = await convertOffer(ctx, input);
    audit.record({
      entityId: result.employee.id,
      companyId: result.companyId,
      summary: `Converted offer for ${result.candidateName} into employee ${result.employee.employeeNo} (${result.employee.fullName})`,
      after: {
        employeeNo: result.employee.employeeNo,
        joiningDate: input.joiningDate,
        fromOffer: result.offerId,
      },
    });
    return { id: result.employee.id, employeeNo: result.employee.employeeNo };
  },
  revalidate: () => [...OFFER_PATHS, "/people/employees"],
});

export const deleteJobOfferAction = defineAction({
  permission: "hr.offers.manage",
  schema: hiringIdSchema,
  audit: { action: "DELETE", entity: "JOB_OFFER" },
  handler: async ({ input, ctx, audit }) => {
    const offer = await deleteJobOffer(ctx, input.id);
    audit.record({
      entityId: offer.id,
      companyId: offer.companyId,
      summary: `Deleted offer for ${offer.candidateName}`,
    });
    return { id: offer.id };
  },
  revalidate: () => OFFER_PATHS,
});
