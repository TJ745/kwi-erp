import { describe, expect, it } from "vitest";
import {
  bankDetailIdSchema, bankDetailSchema, emergencyContactIdSchema, emergencyContactSchema,
  startIqamaRenewalSchema, updateEmergencyContactSchema, updateIqamaRenewalSchema,
} from "./employee";

const CASES: [string, { safeParse: (v: unknown) => { success: boolean } }, Record<string, unknown>][] = [
  ["startIqamaRenewalSchema", startIqamaRenewalSchema, { employeeId: "e1" }],
  ["updateIqamaRenewalSchema", updateIqamaRenewalSchema, { id: "r1", employeeId: "e1", status: "IN_PROGRESS" }],
  ["emergencyContactSchema", emergencyContactSchema, { employeeId: "e1", name: "Ali", relation: "Brother", phone: "+966500000000" }],
  ["updateEmergencyContactSchema", updateEmergencyContactSchema, { id: "c1", employeeId: "e1", name: "Ali", relation: "Brother", phone: "+966500000000" }],
  ["emergencyContactIdSchema", emergencyContactIdSchema, { id: "c1", employeeId: "e1" }],
  ["bankDetailSchema", bankDetailSchema, { employeeId: "e1", bankName: "Al Rajhi", iban: "SA0380000000608010167519" }],
  ["bankDetailIdSchema", bankDetailIdSchema, { employeeId: "e1" }],
];

describe.each(CASES)("%s", (_n, schema, valid) => {
  it("accepts a valid payload (guards the next assertion)", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });
  it("rejects an unknown key", () => {
    expect(schema.safeParse({ ...valid, evilKey: "x" }).success).toBe(false);
  });
  it("rejects server-controlled field shadowing", () => {
    expect(schema.safeParse({ ...valid, createdAt: "2020-01-01" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, deletedAt: null }).success).toBe(false);
  });
});
