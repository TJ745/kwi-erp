"use server";

import { z } from "zod";
import { defineAction } from "./define-action";
import {
  clearanceSchema,
  idSchema,
  interviewSchema,
  joiningLetterSchema,
  prrSchema,
  updateClearanceSchema,
  updateInterviewSchema,
  updateJoiningLetterSchema,
  updatePrrSchema,
} from "@/lib/schemas/recruitment";
import {
  clearanceDefaults,
  createClearanceForm,
  createInterview,
  createJoiningLetter,
  createPrr,
  deleteClearanceForm,
  deleteInterview,
  deleteJoiningLetter,
  deletePrr,
  updateClearanceForm,
  updateInterview,
  updateJoiningLetter,
  updatePrr,
} from "@/server/services/recruitment";

/**
 * Recruitment forms sit with job offers (hr.offers.*); the joining letter and
 * clearance form are HR records about an employee (hr.*).
 */

const PRR_PATHS = ["/hr/personnel-requests", "/hr/interviews"];
const INTERVIEW_PATHS = ["/hr/interviews", "/hr/personnel-requests", "/hr/offers"];
const JOINING_PATHS = ["/hr/joining-letters"];
const CLEARANCE_PATHS = ["/hr/clearance"];

// --- Personnel Requirement Requests ------------------------------------------

export const createPrrAction = defineAction({
  permission: "hr.offers.manage",
  schema: prrSchema,
  audit: { action: "CREATE", entity: "PERSONNEL_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const prr = await createPrr(ctx, input);
    audit.record({
      entityId: prr.id,
      companyId: prr.companyId,
      summary: `Created personnel request ${prr.prrNo} — ${prr.jobTitle}`,
    });
    return { id: prr.id };
  },
  revalidate: () => PRR_PATHS,
});

export const updatePrrAction = defineAction({
  permission: "hr.offers.manage",
  schema: updatePrrSchema,
  audit: { action: "UPDATE", entity: "PERSONNEL_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const prr = await updatePrr(ctx, input);
    audit.record({
      entityId: prr.id,
      companyId: prr.companyId,
      summary: `Updated personnel request ${prr.prrNo} — ${prr.jobTitle}`,
    });
    return { id: prr.id };
  },
  revalidate: () => PRR_PATHS,
});

export const deletePrrAction = defineAction({
  permission: "hr.offers.manage",
  schema: idSchema,
  audit: { action: "DELETE", entity: "PERSONNEL_REQUEST" },
  handler: async ({ input, ctx, audit }) => {
    const prr = await deletePrr(ctx, input.id);
    audit.record({
      entityId: prr.id,
      companyId: prr.companyId,
      summary: `Deleted personnel request ${prr.prrNo} — ${prr.jobTitle}`,
    });
    return { id: prr.id };
  },
  revalidate: () => PRR_PATHS,
});

// --- Interview evaluations ----------------------------------------------------

export const createInterviewAction = defineAction({
  permission: "hr.offers.manage",
  schema: interviewSchema,
  audit: { action: "CREATE", entity: "INTERVIEW_EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const i = await createInterview(ctx, input);
    audit.record({
      entityId: i.id,
      companyId: i.companyId,
      summary: `Created interview evaluation for ${i.applicantName}`,
    });
    return { id: i.id };
  },
  revalidate: () => INTERVIEW_PATHS,
});

export const updateInterviewAction = defineAction({
  permission: "hr.offers.manage",
  schema: updateInterviewSchema,
  audit: { action: "UPDATE", entity: "INTERVIEW_EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const i = await updateInterview(ctx, input);
    audit.record({
      entityId: i.id,
      companyId: i.companyId,
      summary: `Updated interview evaluation for ${i.applicantName}`,
    });
    return { id: i.id };
  },
  revalidate: () => INTERVIEW_PATHS,
});

export const deleteInterviewAction = defineAction({
  permission: "hr.offers.manage",
  schema: idSchema,
  audit: { action: "DELETE", entity: "INTERVIEW_EVALUATION" },
  handler: async ({ input, ctx, audit }) => {
    const i = await deleteInterview(ctx, input.id);
    audit.record({
      entityId: i.id,
      companyId: i.companyId,
      summary: `Deleted interview evaluation for ${i.applicantName}`,
    });
    return { id: i.id };
  },
  revalidate: () => INTERVIEW_PATHS,
});

// --- Joining letters --------------------------------------------------------------

export const createJoiningLetterAction = defineAction({
  permission: "hr.manage",
  schema: joiningLetterSchema,
  audit: { action: "CREATE", entity: "JOINING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const l = await createJoiningLetter(ctx, input);
    audit.record({
      entityId: l.id,
      companyId: l.companyId,
      summary: `Created joining letter for ${l.employeeName}`,
    });
    return { id: l.id };
  },
  revalidate: (input) => [...JOINING_PATHS, `/people/employees/${input.employeeId}`],
});

export const updateJoiningLetterAction = defineAction({
  permission: "hr.manage",
  schema: updateJoiningLetterSchema,
  audit: { action: "UPDATE", entity: "JOINING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const l = await updateJoiningLetter(ctx, input);
    audit.record({
      entityId: l.id,
      companyId: l.companyId,
      summary: `Updated joining letter for ${l.employeeName}`,
    });
    return { id: l.id };
  },
  revalidate: (input) => [...JOINING_PATHS, `/people/employees/${input.employeeId}`],
});

export const deleteJoiningLetterAction = defineAction({
  permission: "hr.manage",
  schema: idSchema,
  audit: { action: "DELETE", entity: "JOINING_LETTER" },
  handler: async ({ input, ctx, audit }) => {
    const l = await deleteJoiningLetter(ctx, input.id);
    audit.record({
      entityId: l.id,
      companyId: l.companyId,
      summary: `Deleted joining letter for ${l.employeeName}`,
    });
    return { id: l.id };
  },
  revalidate: () => JOINING_PATHS,
});

// --- Clearance forms ---------------------------------------------------------------

/** What a new clearance form starts from, once the employee is picked. */
export const clearanceDefaultsAction = defineAction({
  permission: "hr.manage",
  schema: z.object({ employeeId: z.string().min(1) }).strict(),
  handler: async ({ input, ctx }) => clearanceDefaults(ctx, input.employeeId),
});

export const createClearanceAction = defineAction({
  permission: "hr.manage",
  schema: clearanceSchema,
  audit: { action: "CREATE", entity: "CLEARANCE_FORM" },
  handler: async ({ input, ctx, audit }) => {
    const f = await createClearanceForm(ctx, input);
    audit.record({
      entityId: f.id,
      companyId: f.companyId,
      summary: `Created clearance form for ${f.employeeName}`,
    });
    return { id: f.id };
  },
  revalidate: (input) => [...CLEARANCE_PATHS, `/people/employees/${input.employeeId}`],
});

export const updateClearanceAction = defineAction({
  permission: "hr.manage",
  schema: updateClearanceSchema,
  audit: { action: "UPDATE", entity: "CLEARANCE_FORM" },
  handler: async ({ input, ctx, audit }) => {
    const f = await updateClearanceForm(ctx, input);
    audit.record({
      entityId: f.id,
      companyId: f.companyId,
      summary: `Updated clearance form for ${f.employeeName}`,
    });
    return { id: f.id };
  },
  revalidate: (input) => [...CLEARANCE_PATHS, `/people/employees/${input.employeeId}`],
});

export const deleteClearanceAction = defineAction({
  permission: "hr.manage",
  schema: idSchema,
  audit: { action: "DELETE", entity: "CLEARANCE_FORM" },
  handler: async ({ input, ctx, audit }) => {
    const f = await deleteClearanceForm(ctx, input.id);
    audit.record({
      entityId: f.id,
      companyId: f.companyId,
      summary: `Deleted clearance form for ${f.employeeName}`,
    });
    return { id: f.id };
  },
  revalidate: () => CLEARANCE_PATHS,
});
