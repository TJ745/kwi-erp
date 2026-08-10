import { describe, expect, it } from "vitest";
import {
  buildQueryString,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  paginationFor,
  parseListQuery,
  parseSort,
} from "./list-query";

describe("parseListQuery", () => {
  it("applies defaults when nothing is supplied", () => {
    const query = parseListQuery({});
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(query.q).toBeUndefined();
  });

  // Hostile input must never reach a query: a negative page produces a
  // negative skip, and an enormous pageSize is a trivial way to exhaust memory.
  it.each([
    ["negative page", { page: "-5" }, "page", 1],
    ["zero page", { page: "0" }, "page", 1],
    ["non-numeric page", { page: "abc" }, "page", 1],
    ["oversized pageSize", { pageSize: "99999" }, "pageSize", DEFAULT_PAGE_SIZE],
    ["zero pageSize", { pageSize: "0" }, "pageSize", DEFAULT_PAGE_SIZE],
  ])("clamps %s", (_label, params, field, expected) => {
    const query = parseListQuery(params);
    expect(query[field as "page" | "pageSize"]).toBe(expected);
  });

  it("accepts a pageSize at the maximum", () => {
    expect(parseListQuery({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("trims the search term and takes the first of repeated params", () => {
    expect(parseListQuery({ q: "  ahmed  " }).q).toBe("ahmed");
    expect(parseListQuery({ q: ["first", "second"] }).q).toBe("first");
  });

  it("rejects a malformed sort expression", () => {
    expect(parseListQuery({ sort: "name" }).sort).toBeUndefined();
    expect(parseListQuery({ sort: "name.sideways" }).sort).toBeUndefined();
    expect(parseListQuery({ sort: "name.asc" }).sort).toBe("name.asc");
  });
});

describe("parseSort", () => {
  const allowed = ["name", "createdAt"] as const;
  const fallback = { field: "name" as const, direction: "asc" as const };

  it("parses an allowed field", () => {
    expect(parseSort("createdAt.desc", allowed, fallback)).toEqual({
      field: "createdAt",
      direction: "desc",
    });
  });

  // Without the allowlist a caller could sort by — and so probe the ordering
  // of — a column they are not permitted to read.
  it("falls back for a field outside the allowlist", () => {
    expect(parseSort("passwordHash.asc", allowed, fallback)).toEqual(fallback);
    expect(parseSort("role.permissions.asc", allowed, fallback)).toEqual(fallback);
  });

  it("falls back for an invalid direction or missing sort", () => {
    expect(parseSort("name.up", allowed, fallback)).toEqual(fallback);
    expect(parseSort(undefined, allowed, fallback)).toEqual(fallback);
  });
});

describe("pagination", () => {
  it("computes skip and take from the page", () => {
    expect(paginationFor(parseListQuery({ page: "3", pageSize: "10" }))).toEqual({
      skip: 20,
      take: 10,
    });
  });

  it("reports at least one page even when empty", () => {
    const result = paginate([], 0, parseListQuery({}));
    expect(result.pageCount).toBe(1);
    expect(result.total).toBe(0);
  });

  it("rounds the page count up", () => {
    expect(paginate([], 101, parseListQuery({ pageSize: "25" })).pageCount).toBe(5);
  });
});

describe("buildQueryString", () => {
  it("preserves existing params while changing one", () => {
    const qs = buildQueryString({ q: "ahmed", sort: "name.asc" }, { page: 2 });
    expect(qs).toContain("q=ahmed");
    expect(qs).toContain("sort=name.asc");
    expect(qs).toContain("page=2");
  });

  it("removes a param when set to undefined", () => {
    expect(buildQueryString({ q: "ahmed" }, { q: undefined })).toBe("");
  });

  it("returns an empty string when nothing remains", () => {
    expect(buildQueryString({}, {})).toBe("");
  });

  it("takes the first value of a repeated param", () => {
    expect(buildQueryString({ q: ["a", "b"] }, {})).toBe("?q=a");
  });
});
