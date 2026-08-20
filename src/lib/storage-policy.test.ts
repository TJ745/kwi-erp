import { describe, expect, it } from "vitest";
import {
  assertStorageAclPolicy,
  assertStorageTierAllowed,
  storageDisclosure,
} from "./storage-policy";

const SIX_ROUTES_PRIVATE = Array.from({ length: 6 }, () => "private");
const SIX_ROUTES_NO_ACL = Array.from({ length: 6 }, () => undefined);

describe("assertStorageAclPolicy — pro tier", () => {
  it("accepts every route declaring private", () => {
    expect(() => {
      assertStorageAclPolicy("pro", SIX_ROUTES_PRIVATE);
    }).not.toThrow();
  });

  // The dangerous direction: this is the one that silently publishes passports.
  it("rejects a single route missing its ACL", () => {
    expect(() => {
      assertStorageAclPolicy("pro", ["private", "private", undefined]);
    }).toThrow(/publicly\s+readable/);
  });

  it("rejects a route declaring public-read", () => {
    expect(() => {
      assertStorageAclPolicy("pro", ["private", "public-read"]);
    }).toThrow(/not declared with/);
  });

  it("reports how many routes are wrong", () => {
    expect(() => {
      assertStorageAclPolicy("pro", [undefined, undefined, "private"]);
    }).toThrow(/2 upload route/);
  });
});

describe("assertStorageAclPolicy — free tier", () => {
  it("accepts routes that declare no ACL", () => {
    expect(() => {
      assertStorageAclPolicy("free", SIX_ROUTES_NO_ACL);
    }).not.toThrow();
  });

  // The free plan answers an explicit ACL with HTTP 400, so this would be a
  // total upload outage rather than a leak.
  it("rejects a private ACL, which the free plan cannot honour", () => {
    expect(() => {
      assertStorageAclPolicy("free", [undefined, "private"]);
    }).toThrow(/rejects ACL declarations with HTTP 400/);
  });

  it("names the fix in the message", () => {
    expect(() => {
      assertStorageAclPolicy("free", ["private"]);
    }).toThrow(/UPLOADTHING_TIER=pro/);
  });
});

describe("assertStorageTierAllowed", () => {
  // Development is where the free tier is expected, so it must never block.
  it.each(["development", "test"])("allows the free tier in %s", (nodeEnv) => {
    expect(() => {
      assertStorageTierAllowed({ nodeEnv, tier: "free", accepted: false });
    }).not.toThrow();
  });

  it("blocks the free tier in production by default", () => {
    expect(() => {
      assertStorageTierAllowed({ nodeEnv: "production", tier: "free", accepted: false });
    }).toThrow(/readable by anyone holding the object URL/);
  });

  it("allows the free tier in production once explicitly accepted", () => {
    expect(() => {
      assertStorageTierAllowed({ nodeEnv: "production", tier: "free", accepted: true });
    }).not.toThrow();
  });

  it("always allows the pro tier", () => {
    for (const nodeEnv of ["development", "production"]) {
      expect(() => {
        assertStorageTierAllowed({ nodeEnv, tier: "pro", accepted: false });
      }).not.toThrow();
    }
  });

  it("names both escape hatches in the message", () => {
    expect(() => {
      assertStorageTierAllowed({ nodeEnv: "production", tier: "free", accepted: false });
    }).toThrow(/UPLOADTHING_TIER=pro.*ACCEPT_PUBLIC_FILE_STORAGE=true/s);
  });
});

describe("assertStorageAclPolicy — edges", () => {
  it("accepts an empty route list on either tier", () => {
    expect(() => {
      assertStorageAclPolicy("free", []);
    }).not.toThrow();
    expect(() => {
      assertStorageAclPolicy("pro", []);
    }).not.toThrow();
  });

  // The two tiers must not both accept the same configuration, or the switch
  // would be decorative.
  it("the two tiers accept mutually exclusive configurations", () => {
    const free = () => {
      assertStorageAclPolicy("free", SIX_ROUTES_PRIVATE);
    };
    const pro = () => {
      assertStorageAclPolicy("pro", SIX_ROUTES_NO_ACL);
    };
    expect(free).toThrow();
    expect(pro).toThrow();
  });
});

describe("storageDisclosure", () => {
  it("says nothing on the pro tier — there is no exposure to disclose", () => {
    expect(storageDisclosure({ tier: "pro", accepted: false })).toBeNull();
    expect(storageDisclosure({ tier: "pro", accepted: true })).toBeNull();
  });

  it("warns when free storage has NOT been accepted", () => {
    const result = storageDisclosure({ tier: "free", accepted: false });
    expect(result?.level).toBe("warn");
    // It must name the fix for the 503 that free-in-production produces.
    expect(result?.message).toContain("ACCEPT_PUBLIC_FILE_STORAGE=true");
    expect(result?.message).toContain("refuse");
  });

  it("drops to info once the exposure is accepted, rather than nagging", () => {
    const result = storageDisclosure({ tier: "free", accepted: true });
    expect(result?.level).toBe("info");
  });

  it("never goes silent on free: the exposure is stated either way", () => {
    for (const accepted of [true, false]) {
      const result = storageDisclosure({ tier: "free", accepted });
      expect(result).not.toBeNull();
      // The point of the line is that the bytes are reachable by URL alone.
      expect(result?.message).toContain("readable by anyone holding the object URL");
      expect(result?.message).toContain("identity scans");
    }
  });

  it("does not tell an accepted deployment to switch to pro", () => {
    // The stale advice that made the old message read as an unresolved
    // problem every single boot.
    const result = storageDisclosure({ tier: "free", accepted: true });
    expect(result?.message).not.toContain("UPLOADTHING_TIER=pro");
  });
});
