import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("allows same-site absolute paths", () => {
    expect(safeRedirect("/people/employees")).toBe("/people/employees");
    expect(safeRedirect("/tasks?status=TODO")).toBe("/tasks?status=TODO");
  });

  it("falls back when no target is supplied", () => {
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
  });

  // Each of these is a real open-redirect vector.
  it.each([
    ["absolute URL", "https://evil.example.com"],
    ["protocol-relative", "//evil.example.com"],
    ["backslash protocol-relative", "/\\evil.example.com"],
    ["embedded backslash", "/path\\..\\evil"],
    ["javascript scheme", "javascript:alert(1)"],
    ["path-prefixed scheme", "/javascript:alert(1)"],
    ["scheme after slash", "/https://evil.example.com"],
    ["bare relative path", "people/employees"],
  ])("rejects %s", (_label, input) => {
    expect(safeRedirect(input)).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeRedirect("https://evil.example.com", "/login")).toBe("/login");
  });
});
