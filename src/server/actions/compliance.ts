"use server";

import {
  certificateSchema,
  complianceIdSchema,
  updateCertificateSchema,
} from "@/lib/schemas/compliance";
import { defineAction } from "./define-action";
import {
  createCertificate,
  deleteCertificate,
  updateCertificate,
} from "@/server/services/compliance";

const CERT_PATHS = ["/admin/certificates", "/dashboard"];

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
