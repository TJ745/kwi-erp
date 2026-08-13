"use server";

import {
  billSchema,
  certificateSchema,
  complianceIdSchema,
  markBillPaidSchema,
  updateBillSchema,
  updateCertificateSchema,
} from "@/lib/schemas/compliance";
import { defineAction } from "./define-action";
import {
  createBill,
  createCertificate,
  deleteBill,
  deleteCertificate,
  markBillPaid,
  updateBill,
  updateCertificate,
} from "@/server/services/compliance";

const CERT_PATHS = ["/admin/certificates", "/dashboard"];
const BILL_PATHS = ["/admin/electricity-bills"];

// --- Certificates ------------------------------------------------------------

export const createCertificateAction = defineAction({
  permission: "certificates.manage",
  schema: certificateSchema,
  audit: { action: "CREATE", entity: "COMPANY_CERTIFICATE" },
  handler: async ({ input, ctx, audit }) => {
    const certificate = await createCertificate(ctx, input);
    audit.record({
      entityId: certificate.id,
      companyId: certificate.companyId,
      summary: `Added ${certificate.typeName} ${certificate.certificateNo} for ${certificate.companyCode}`,
      after: {
        certificateNo: certificate.certificateNo,
        expiryDate: certificate.expiryDate,
        status: certificate.status,
      },
    });
    return { id: certificate.id };
  },
  revalidate: () => CERT_PATHS,
});

export const updateCertificateAction = defineAction({
  permission: "certificates.manage",
  schema: updateCertificateSchema,
  audit: { action: "UPDATE", entity: "COMPANY_CERTIFICATE" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after, typeName, companyCode } = await updateCertificate(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated ${typeName} ${after.certificateNo} for ${companyCode}`,
      before: {
        certificateNo: before.certificateNo,
        expiryDate: before.expiryDate,
        status: before.status,
      },
      after: {
        certificateNo: after.certificateNo,
        expiryDate: after.expiryDate,
        status: after.status,
      },
    });
    return { id: after.id };
  },
  revalidate: () => CERT_PATHS,
});

export const deleteCertificateAction = defineAction({
  permission: "certificates.manage",
  schema: complianceIdSchema,
  audit: { action: "DELETE", entity: "COMPANY_CERTIFICATE" },
  handler: async ({ input, ctx, audit }) => {
    const certificate = await deleteCertificate(ctx, input.id);
    audit.record({
      entityId: certificate.id,
      companyId: certificate.companyId,
      summary: `Deleted ${certificate.certificateType.name} ${certificate.certificateNo} for ${certificate.company.code}`,
    });
    return { id: certificate.id };
  },
  revalidate: () => CERT_PATHS,
});

// --- Electricity bills -------------------------------------------------------

export const createBillAction = defineAction({
  permission: "bills.manage",
  schema: billSchema,
  audit: { action: "CREATE", entity: "ELECTRICITY_BILL" },
  handler: async ({ input, ctx, audit }) => {
    const bill = await createBill(ctx, input);
    audit.record({
      entityId: bill.id,
      companyId: bill.companyId,
      summary: `Added bill for meter ${bill.meterNumber} at ${bill.location} — ${bill.amount.toString()} ${bill.currency}`,
      after: { amount: bill.amount.toString(), dueDate: bill.dueDate, status: bill.status },
    });
    return { id: bill.id };
  },
  revalidate: () => BILL_PATHS,
});

export const updateBillAction = defineAction({
  permission: "bills.manage",
  schema: updateBillSchema,
  audit: { action: "UPDATE", entity: "ELECTRICITY_BILL" },
  handler: async ({ input, ctx, audit }) => {
    const { before, after } = await updateBill(ctx, input);
    audit.record({
      entityId: after.id,
      companyId: after.companyId,
      summary: `Updated bill for meter ${after.meterNumber}`,
      before: {
        amount: before.amount.toString(),
        dueDate: before.dueDate,
        status: before.status,
      },
      after: {
        amount: after.amount.toString(),
        dueDate: after.dueDate,
        status: after.status,
      },
    });
    return { id: after.id };
  },
  revalidate: () => BILL_PATHS,
});

/** Separate from the full edit: recording a payment is the frequent action. */
export const markBillPaidAction = defineAction({
  permission: "bills.manage",
  schema: markBillPaidSchema,
  audit: { action: "UPDATE", entity: "ELECTRICITY_BILL" },
  handler: async ({ input, ctx, audit }) => {
    const bill = await markBillPaid(ctx, input);
    audit.record({
      entityId: bill.id,
      companyId: bill.companyId,
      summary: `Marked bill for meter ${bill.meterNumber} paid — ${bill.amount.toString()} ${bill.currency}`,
      before: { status: bill.before },
      after: { status: bill.after, paidDate: input.paidDate },
    });
    return { id: bill.id };
  },
  revalidate: () => BILL_PATHS,
});

export const deleteBillAction = defineAction({
  permission: "bills.manage",
  schema: complianceIdSchema,
  audit: { action: "DELETE", entity: "ELECTRICITY_BILL" },
  handler: async ({ input, ctx, audit }) => {
    const bill = await deleteBill(ctx, input.id);
    audit.record({
      entityId: bill.id,
      companyId: bill.companyId,
      summary: `Deleted bill for meter ${bill.meterNumber} at ${bill.location}`,
    });
    return { id: bill.id };
  },
  revalidate: () => BILL_PATHS,
});
