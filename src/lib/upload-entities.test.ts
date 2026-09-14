import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UPLOAD_ENTITY_LABELS, UPLOAD_ENTITY_TYPES } from "./upload-entities";

/**
 * The pairing these tests exist to protect:
 *
 *   UPLOAD_ENTITY_TYPES says what an upload MAY attach to.
 *   isUploadTargetInScope decides whether the caller may reach that record.
 *
 * A value in the first without a case in the second is an upload that nothing
 * authorises — the guard's `default` returns false today, so the failure is
 * closed rather than open, but it presents as "uploads are broken for this
 * module" and the tempting fix is to loosen the guard. Better to fail here.
 */
const GUARD_SOURCE = readFileSync("src/server/services/documents.ts", "utf8");

describe("UPLOAD_ENTITY_TYPES", () => {
  it("has a scope case for every entity it allows", () => {
    const missing = UPLOAD_ENTITY_TYPES.filter(
      (type) => !GUARD_SOURCE.includes(`case "${type}":`),
    );
    expect(missing, `no case in isUploadTargetInScope for: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("labels every entity", () => {
    for (const type of UPLOAD_ENTITY_TYPES) {
      expect(UPLOAD_ENTITY_LABELS[type], `no label for ${type}`).toBeTruthy();
    }
    expect(Object.keys(UPLOAD_ENTITY_LABELS)).toHaveLength(UPLOAD_ENTITY_TYPES.length);
  });

  it("contains no duplicates", () => {
    expect(new Set(UPLOAD_ENTITY_TYPES).size).toBe(UPLOAD_ENTITY_TYPES.length);
  });

  it("keeps the guard's default closed", () => {
    // The catch-all must refuse. If this ever becomes `return true`, every
    // unlisted entity type becomes uploadable without a scope check.
    expect(GUARD_SOURCE).toMatch(/default:\s*\n\s*return false;/);
  });

  it("covers the twelve modules the upload panels are built for", () => {
    for (const type of [
      "EMPLOYEE",
      "CONTRACT",
      "JOB_OFFER",
      "ACCOMMODATION",
      "SUPPLIER",
      "SUBCONTRACTOR",
      "ELECTRICITY_BILL",
      "COMPANY_CERTIFICATE",
      "IT_ASSET",
      "VEHICLE",
      "VEHICLE_MAINTENANCE",
      "MEDICAL_INSURANCE_POLICY",
    ]) {
      expect(UPLOAD_ENTITY_TYPES).toContain(type);
    }
  });
});
