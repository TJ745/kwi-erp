import { describe, expect, it } from "vitest";
import { updateEmployeeSchema, employeeSchema, employeeStatusSchema } from "./employee";
import { updateVehicleSchema, vehicleSchema } from "./fleet";
import { updateContractSchema, contractSchema } from "./hr";
import { updatePolicySchema, policySchema } from "./insurance";
import { updateAssetSchema, assetSchema } from "./it";
import { cctvSchema, ipPhoneSchema, updateCctvSchema, updateIpPhoneSchema } from "./infrastructure";
import { meterSchema, updateMeterSchema } from "./meters";

/**
 * SECURITY.md §11: "Every Zod schema is `.strict()`."
 *
 * The update schemas were previously built as `z.object({ id }).and(base)`.
 * That construction silently loses strictness — a Zod intersection with a bare
 * object accepts unknown keys even when the other side is strict. It was found
 * in the Phase 13 review and is exactly the kind of regression a refactor
 * reintroduces without anyone noticing, because nothing visibly breaks.
 *
 * Each case supplies a VALID base payload first. An earlier version of this
 * check used inputs that failed for unrelated reasons ("Title is required"),
 * so the schema appeared to reject the unknown key when it had never been
 * reached — a false pass. The `accepts a valid payload` assertion exists to
 * make that failure mode impossible.
 */

const VALID = {
  employee: {
    employeeNo: "KWI-014",
    companyId: "c1",
    firstName: "Ahmed",
    lastName: "Khan",
    gender: "MALE",
    nationality: "PK",
    joiningDate: "2026-01-01",
    status: "ACTIVE",
    employmentType: "FULL_TIME",
  },
  vehicle: {
    companyId: "c1",
    plateNumber: "ABC 123",
    make: "Toyota",
    model: "Hilux",
    year: "2024",
    status: "ACTIVE",
  },
  contract: {
    employeeId: "e1",
    companyId: "c1",
    contractType: "PERMANENT",
    startDate: "2026-01-01",
    status: "ACTIVE",
    currency: "SAR",
  },
  policy: {
    companyId: "c1",
    providerId: "p1",
    policyNumber: "POL-1",
    startDate: "2026-01-01",
    expiryDate: "2026-12-31",
    status: "ACTIVE",
    isWorking: true,
    currency: "SAR",
  },
  // No `status` or `currency`: the asset schema does not declare them, so
  // including them would make this payload invalid — which the guard assertion
  // above caught when this test was first written.
  asset: {
    companyId: "c1",
    type: "LAPTOP",
    brand: "Dell",
    model: "Latitude",
    condition: "GOOD",
  },
  meter: {
    meterNumber: "MTR-1001",
    location: "Camp A, Block 3",
  },
  cctv: {
    assetId: "asset-2",
    type: "DOME",
  },
  ipPhone: {
    extension: "2041",
    assetId: "asset-1",
  },
} as const;

type Parser = { safeParse: (value: unknown) => { success: boolean } };

const CASES: [string, Parser, Record<string, unknown>][] = [
  ["employeeSchema", employeeSchema, VALID.employee],
  ["updateEmployeeSchema", updateEmployeeSchema, { ...VALID.employee, id: "x" }],
  ["vehicleSchema", vehicleSchema, VALID.vehicle],
  ["updateVehicleSchema", updateVehicleSchema, { ...VALID.vehicle, id: "x" }],
  ["contractSchema", contractSchema, VALID.contract],
  ["updateContractSchema", updateContractSchema, { ...VALID.contract, id: "x" }],
  ["policySchema", policySchema, VALID.policy],
  ["updatePolicySchema", updatePolicySchema, { ...VALID.policy, id: "x" }],
  ["assetSchema", assetSchema, VALID.asset],
  ["updateAssetSchema", updateAssetSchema, { ...VALID.asset, id: "x" }],
  ["meterSchema", meterSchema, VALID.meter],
  ["updateMeterSchema", updateMeterSchema, { ...VALID.meter, id: "x" }],
  ["cctvSchema", cctvSchema, VALID.cctv],
  ["updateCctvSchema", updateCctvSchema, { ...VALID.cctv, id: "x" }],
  ["ipPhoneSchema", ipPhoneSchema, VALID.ipPhone],
  ["updateIpPhoneSchema", updateIpPhoneSchema, { ...VALID.ipPhone, id: "x" }],
];

describe.each(CASES)("%s", (_name, schema, valid) => {
  // Guards the assertion below: a base payload that is invalid for some other
  // reason would make the unknown-key test vacuous.
  it("accepts a valid payload", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown key", () => {
    expect(schema.safeParse({ ...valid, evilKey: "x" }).success).toBe(false);
  });

  it("rejects a key shadowing a server-controlled field", () => {
    // The shapes that mass assignment would target.
    expect(schema.safeParse({ ...valid, createdAt: "2020-01-01" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, deletedAt: null }).success).toBe(false);
  });
});

describe("cross-field rules survive the update variant", () => {
  it("employee: last working date cannot precede joining", () => {
    const bad = { ...VALID.employee, id: "x", lastWorkingDate: "2020-01-01" };
    expect(updateEmployeeSchema.safeParse(bad).success).toBe(false);
    expect(employeeSchema.safeParse({ ...VALID.employee, lastWorkingDate: "2020-01-01" }).success).toBe(false);
  });

  it("employee: a leaving status requires a last working date", () => {
    // The rule lived only in `setEmployeeStatus`, which had no caller, so the
    // edit form could mark someone TERMINATED with no leaving date.
    for (const status of ["RESIGNED", "TERMINATED", "EXITED"]) {
      const missing = { ...VALID.employee, status };
      expect(employeeSchema.safeParse(missing).success).toBe(false);
      expect(updateEmployeeSchema.safeParse({ ...missing, id: "x" }).success).toBe(false);

      const supplied = { ...missing, lastWorkingDate: "2026-06-30" };
      expect(employeeSchema.safeParse(supplied).success).toBe(true);
      expect(updateEmployeeSchema.safeParse({ ...supplied, id: "x" }).success).toBe(true);
    }
  });

  it("employee: a non-leaving status does not require a last working date", () => {
    // The control: the rule must not fire on statuses where the person stays.
    for (const status of ["ACTIVE", "ON_LEAVE", "INACTIVE"]) {
      expect(employeeSchema.safeParse({ ...VALID.employee, status }).success).toBe(true);
    }
  });

  it("employee status transition: the same rule applies to the dedicated action", () => {
    expect(
      employeeStatusSchema.safeParse({ id: "e1", status: "TERMINATED" }).success,
    ).toBe(false);
    expect(
      employeeStatusSchema.safeParse({
        id: "e1",
        status: "TERMINATED",
        lastWorkingDate: "2026-06-30",
      }).success,
    ).toBe(true);
    expect(employeeStatusSchema.safeParse({ id: "e1", status: "ACTIVE" }).success).toBe(true);
  });

  it("policy: expiry cannot precede start", () => {
    const bad = { ...VALID.policy, expiryDate: "2020-01-01" };
    expect(updatePolicySchema.safeParse({ ...bad, id: "x" }).success).toBe(false);
    expect(policySchema.safeParse(bad).success).toBe(false);
  });

  it("contract: a fixed-term contract needs an end date", () => {
    const bad = { ...VALID.contract, contractType: "FIXED_TERM" };
    expect(updateContractSchema.safeParse({ ...bad, id: "x" }).success).toBe(false);
    expect(contractSchema.safeParse(bad).success).toBe(false);
  });

  it("asset: warranty cannot expire before purchase", () => {
    const bad = { ...VALID.asset, purchaseDate: "2026-06-01", warrantyExpiry: "2020-01-01" };
    expect(updateAssetSchema.safeParse({ ...bad, id: "x" }).success).toBe(false);
    expect(assetSchema.safeParse(bad).success).toBe(false);
  });

  it("asset: IP address must be a real address", () => {
    expect(assetSchema.safeParse({ ...VALID.asset, ipAddress: "10.0.1.25" }).success).toBe(true);
    expect(assetSchema.safeParse({ ...VALID.asset, ipAddress: "10.0.1.999" }).success).toBe(false);
    expect(updateAssetSchema.safeParse({ ...VALID.asset, ipAddress: "printer", id: "x" }).success).toBe(false);
  });

  it("CCTV: hardware fields belong to the asset, and a recorder records nothing", () => {
    expect(cctvSchema.safeParse({ ...VALID.cctv, location: "Gate" }).success).toBe(false);
    expect(cctvSchema.safeParse({ type: "DOME" }).success).toBe(false);
    expect(cctvSchema.safeParse({ ...VALID.cctv, type: "NVR", recorderId: "r1" }).success).toBe(false);
  });

  it("IP phone: needs a handset, and handset details are not accepted here", () => {
    expect(ipPhoneSchema.safeParse({ extension: "2041" }).success).toBe(false);
    // Model and MAC belong to the asset; sending them is an unknown key.
    expect(ipPhoneSchema.safeParse({ ...VALID.ipPhone, macAddress: "00:1A:2B:3C:4D:5E" }).success).toBe(false);
    expect(ipPhoneSchema.safeParse({ ...VALID.ipPhone, extension: "20a1" }).success).toBe(false);
  });

  it("asset: MAC address is normalised, and a malformed one is refused", () => {
    const ok = assetSchema.safeParse({ ...VALID.asset, macAddress: "00-1a-2b-3c-4d-5e" });
    expect(ok.success && ok.data.macAddress).toBe("00:1A:2B:3C:4D:5E");
    expect(assetSchema.safeParse({ ...VALID.asset, macAddress: "00:1A:2B" }).success).toBe(false);
    expect(assetSchema.safeParse({ ...VALID.asset, macAddress: "" }).success).toBe(true);
  });

  it("meter: number and location are both required", () => {
    expect(meterSchema.safeParse({ ...VALID.meter, meterNumber: "" }).success).toBe(false);
    expect(meterSchema.safeParse({ ...VALID.meter, location: " " }).success).toBe(false);
  });
});
