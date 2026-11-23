/**
 * Entities a document can be attached to.
 *
 * Deliberately a subset of the full `EntityType`: a document may only hang off
 * something that resolves to an owning COMPANY, because company scope is what
 * `isUploadTargetInScope` checks before accepting any upload. Adding a value
 * here without adding its case there would accept an upload that nothing
 * authorises, so the two are meant to be edited together — the exhaustive test
 * in documents.test.ts fails when they disagree.
 */
export const UPLOAD_ENTITY_TYPES = [
  "EMPLOYEE",
  "COMPANY",
  "VEHICLE",
  "VEHICLE_MAINTENANCE",
  "IT_ASSET",
  "CONTRACT",
  "JOB_OFFER",
  "ACCOMMODATION",
  "SUBCONTRACTOR",
  "COMPANY_CERTIFICATE",
  "MEDICAL_INSURANCE_POLICY",
] as const;

export type UploadEntityType = (typeof UPLOAD_ENTITY_TYPES)[number];

/** Human label for each, used by the upload dialog and the documents list. */
export const UPLOAD_ENTITY_LABELS: Record<UploadEntityType, string> = {
  EMPLOYEE: "Employee",
  COMPANY: "Company",
  VEHICLE: "Vehicle",
  VEHICLE_MAINTENANCE: "Vehicle maintenance",
  IT_ASSET: "IT asset",
  CONTRACT: "Contract",
  JOB_OFFER: "Job offer",
  ACCOMMODATION: "Accommodation",
  SUBCONTRACTOR: "Subcontractor",
  COMPANY_CERTIFICATE: "Company certificate",
  MEDICAL_INSURANCE_POLICY: "Insurance policy",
};
