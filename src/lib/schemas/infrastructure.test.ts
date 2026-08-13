import { describe, expect, it } from "vitest";
import { isValidIp, normaliseMac } from "./infrastructure";

describe("isValidIp", () => {
  it.each(["10.0.0.1", "192.168.1.254", "0.0.0.0", "255.255.255.255"])(
    "accepts %s",
    (ip) => {
      expect(isValidIp(ip)).toBe(true);
    },
  );

  it("rejects an octet above 255", () => {
    expect(isValidIp("192.168.1.256")).toBe(false);
    expect(isValidIp("999.1.1.1")).toBe(false);
  });

  // Some tools read a leading zero as octal, so 010 is not 10.
  it("rejects leading zeros", () => {
    expect(isValidIp("192.168.01.1")).toBe(false);
  });

  it.each(["", "192.168.1", "192.168.1.1.1", "not-an-ip", "192.168.1.a"])(
    "rejects %j",
    (ip) => {
      expect(isValidIp(ip)).toBe(false);
    },
  );

  it("accepts IPv6-shaped values", () => {
    expect(isValidIp("fe80::1")).toBe(true);
    expect(isValidIp("2001:db8::8a2e:370:7334")).toBe(true);
  });

  it("rejects an IPv6-ish string with invalid characters", () => {
    expect(isValidIp("fe80::zz")).toBe(false);
  });
});

describe("normaliseMac", () => {
  it("normalises colon-separated input", () => {
    expect(normaliseMac("00:1a:2b:3c:4d:5e")).toBe("00:1A:2B:3C:4D:5E");
  });

  // The three separators people actually paste.
  it.each(["00-1A-2B-3C-4D-5E", "001A.2B3C.4D5E", "001a2b3c4d5e"])(
    "accepts %s and returns one canonical form",
    (input) => {
      expect(normaliseMac(input)).toBe("00:1A:2B:3C:4D:5E");
    },
  );

  it("rejects the wrong number of hex digits", () => {
    expect(normaliseMac("00:1A:2B:3C:4D")).toBeNull();
    expect(normaliseMac("00:1A:2B:3C:4D:5E:6F")).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(normaliseMac("00:1A:2B:3C:4D:5Z")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(normaliseMac("")).toBeNull();
  });

  // Two people entering the same address differently must collide, not
  // create two rows for one physical device.
  it("makes differently-formatted duplicates identical", () => {
    expect(normaliseMac("aa-bb-cc-dd-ee-ff")).toBe(normaliseMac("AA:BB:CC:DD:EE:FF"));
  });
});
