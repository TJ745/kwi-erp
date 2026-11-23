import { describe, expect, it } from "vitest";
import { diffRecords, redact, REDACTED_PLACEHOLDER } from "./redact";

describe("diffRecords", () => {
  it("records only fields that actually changed", () => {
    const changes = diffRecords(
      { name: "Ahmed", city: "Riyadh" },
      { name: "Ahmed Khan", city: "Riyadh" },
    );
    expect(Object.keys(changes)).toEqual(["name"]);
    expect(changes.name).toEqual({ before: "Ahmed", after: "Ahmed Khan" });
  });

  it("treats equal dates as unchanged", () => {
    const changes = diffRecords(
      { joiningDate: new Date("2026-01-01") },
      { joiningDate: new Date("2026-01-01") },
    );
    expect(changes).toEqual({});
  });

  // The core guarantee: the FACT of the change is auditable, the value is not.
  it.each([
    "password",
    "passwordHash",
    "iban",
    "accountNo",
    "ciphertext",
    "wrappedDek",
    "authTag",
    "sessionToken",
  ])("masks %s in both directions", (field) => {
    const changes = diffRecords({ [field]: "old-secret" }, { [field]: "new-secret" });
    expect(changes[field]).toEqual({
      before: REDACTED_PLACEHOLDER,
      after: REDACTED_PLACEHOLDER,
    });
  });

  it("masks derived secret-ish field names", () => {
    const changes = diffRecords(
      { vaultPassword: "a", apiKeySecret: "b", refreshToken: "c" },
      { vaultPassword: "x", apiKeySecret: "y", refreshToken: "z" },
    );
    for (const key of ["vaultPassword", "apiKeySecret", "refreshToken"]) {
      expect(changes[key]?.after).toBe(REDACTED_PLACEHOLDER);
    }
  });

  it("never lets raw bytes into the diff", () => {
    const changes = diffRecords({ blob: new Uint8Array([1, 2, 3]) }, { blob: new Uint8Array([4]) });
    expect(changes.blob?.after).toBe(REDACTED_PLACEHOLDER);
  });

  it("serialises dates and bigints to stable values", () => {
    const changes = diffRecords(
      { at: new Date("2026-01-01"), n: 1n },
      { at: new Date("2026-02-01"), n: 2n },
    );
    expect(changes.at?.after).toBe("2026-02-01T00:00:00.000Z");
    expect(changes.n?.after).toBe("2");
  });

  it("captures creation and deletion as null on the empty side", () => {
    expect(diffRecords(null, { name: "New" }).name).toEqual({ before: null, after: "New" });
    expect(diffRecords({ name: "Old" }, null).name).toEqual({ before: "Old", after: null });
  });
});

describe("redact", () => {
  it("masks sensitive keys and passes the rest through", () => {
    const out = redact({ email: "a@b.c", password: "hunter2", iban: "SA123" });
    expect(out.email).toBe("a@b.c");
    expect(out.password).toBe(REDACTED_PLACEHOLDER);
    expect(out.iban).toBe(REDACTED_PLACEHOLDER);
  });
});
