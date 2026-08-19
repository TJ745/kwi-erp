import { describe, expect, it } from "vitest";
import {
  isLetterheadEligible,
  LETTERHEAD_SLOTS,
  slotColumn,
  slotFromPathSegment,
} from "./letterhead";

const clean = (mimeType: string, detectedType: string | null) => ({
  mimeType,
  detectedType,
  scanStatus: "CLEAN",
});

describe("slotFromPathSegment", () => {
  it("maps the two real segments", () => {
    expect(slotFromPathSegment("header")).toBe("HEADER");
    expect(slotFromPathSegment("footer")).toBe("FOOTER");
  });

  it("rejects anything else, including case variants and traversal attempts", () => {
    for (const segment of ["HEADER", "Header", "logo", "", "..", "header/", "header "]) {
      expect(slotFromPathSegment(segment)).toBeNull();
    }
  });
});

describe("slotColumn", () => {
  it("covers every slot and never returns the same column twice", () => {
    const columns = LETTERHEAD_SLOTS.map(slotColumn);
    expect(columns).toEqual(["headerImageFileId", "footerImageFileId"]);
    expect(new Set(columns).size).toBe(LETTERHEAD_SLOTS.length);
  });
});

describe("isLetterheadEligible", () => {
  it("accepts verified PNG, JPEG, and WebP", () => {
    expect(isLetterheadEligible(clean("image/png", "png"))).toBe(true);
    expect(isLetterheadEligible(clean("image/jpeg", "jpg"))).toBe(true);
    expect(isLetterheadEligible(clean("image/jpeg", "jpeg"))).toBe(true);
    expect(isLetterheadEligible(clean("image/webp", "webp"))).toBe(true);
  });

  it("refuses SVG even when the bytes are genuinely SVG", () => {
    // The whole point: letterhead is rendered inline into an authenticated
    // page, and an SVG can carry script and external references.
    expect(isLetterheadEligible(clean("image/svg+xml", "svg"))).toBe(false);
  });

  it("refuses documents that are not images at all", () => {
    expect(isLetterheadEligible(clean("application/pdf", "pdf"))).toBe(false);
    expect(isLetterheadEligible(clean("application/msword", "doc"))).toBe(false);
    expect(isLetterheadEligible(clean("text/html", "html"))).toBe(false);
  });

  it("refuses a file whose declared type and sniffed bytes disagree", () => {
    // A PDF renamed .png: the browser said image, the bytes said otherwise.
    expect(isLetterheadEligible(clean("image/png", "pdf"))).toBe(false);
    // And the reverse: honest MIME, image bytes, still not an allowed type.
    expect(isLetterheadEligible(clean("application/pdf", "png"))).toBe(false);
  });

  it("refuses a file that was never sniffed", () => {
    expect(isLetterheadEligible(clean("image/png", null))).toBe(false);
  });

  it("refuses a valid image that has not passed verification", () => {
    for (const scanStatus of ["PENDING", "INFECTED", "FAILED", ""]) {
      expect(
        isLetterheadEligible({ mimeType: "image/png", detectedType: "png", scanStatus }),
      ).toBe(false);
    }
  });

  it("does not treat an image/* prefix as sufficient", () => {
    // Guards against a future refactor to `mimeType.startsWith("image/")`,
    // which would let image/svg+xml back in.
    expect(isLetterheadEligible(clean("image/svg+xml", "png"))).toBe(false);
    expect(isLetterheadEligible(clean("image/gif", "gif"))).toBe(false);
  });
});
