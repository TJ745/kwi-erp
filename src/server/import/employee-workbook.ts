import "server-only";
import ExcelJS from "exceljs";
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  IMPORT_REFERENCE_SHEET_NAME,
  IMPORT_SHEET_NAME,
  enumChoices,
  type ImportColumnKey,
  type ImportRow,
} from "@/lib/employee-import";

/**
 * The employee import template — ADR-003 (exceljs).
 *
 * Generated on request rather than shipped as a static file so the Reference
 * sheet lists the companies, departments and positions that exist right now,
 * and so the dropdowns can never drift from the validator's accepted values.
 */
export async function buildEmployeeTemplate(refs: {
  companies: { code: string; name: string }[];
  departments: { name: string; companyCode: string }[];
  positions: { title: string; companyCode: string | null }[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(IMPORT_SHEET_NAME);

  const header = sheet.addRow(IMPORT_COLUMNS.map((c) => c.header));
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  header.border = { bottom: { style: "thin" } };
  header.height = 20;

  // Required columns are marked in the header cell's own comment so the
  // header text stays exactly what the parser matches on.
  IMPORT_COLUMNS.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    const notes = [column.required ? "Required." : "Optional.", "hint" in column ? column.hint : ""]
      .filter(Boolean)
      .join(" ");
    cell.note = notes;
    if (column.required) cell.font = { bold: true, color: { argb: "FF9A3412" } };
  });

  // One example row, so the shape of every value is shown rather than
  // described. It is a real-looking row on purpose — people copy the pattern.
  const example = sheet.addRow(IMPORT_COLUMNS.map((c) => c.example));
  example.font = { italic: true, color: { argb: "FF6B7280" } };
  example.getCell(1).note = "Example row — overwrite or delete it before importing.";

  // Every data column is text. Excel would otherwise turn 0501234567 into
  // 501234567 and an employee number like 1042 into a number.
  IMPORT_COLUMNS.forEach((column, index) => {
    const col = sheet.getColumn(index + 1);
    col.numFmt = "@";
    col.width = Math.min(Math.max(column.header.length, column.example.length, 10) + 4, 40);
  });

  // Dropdowns on the enum columns, for every row the import will accept.
  // exceljs exposes validation per cell, so it is set on each.
  const dropdown = (key: ImportColumnKey, choices: string[]) => {
    const index = IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1;
    for (let r = 2; r <= IMPORT_MAX_ROWS + 1; r++) {
      sheet.getCell(r, index).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${choices.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Not a valid choice",
        error: `Choose one of: ${choices.join(", ")}`,
      };
    }
  };
  dropdown("gender", enumChoices("gender"));
  dropdown("maritalStatus", enumChoices("maritalStatus"));
  dropdown("status", enumChoices("status"));
  dropdown("employmentType", enumChoices("employmentType"));
  dropdown(
    "companyCode",
    refs.companies.map((c) => c.code),
  );

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // What the lookups will match against. Separate sheet so the data sheet is
  // nothing but employee rows.
  const reference = workbook.addWorksheet(IMPORT_REFERENCE_SHEET_NAME);
  reference.addRow(["Companies"]).font = { bold: true, size: 12 };
  reference.addRow(["Code", "Name"]).font = { bold: true };
  for (const company of refs.companies) reference.addRow([company.code, company.name]);
  reference.addRow([]);
  reference.addRow(["Departments"]).font = { bold: true, size: 12 };
  reference.addRow(["Company", "Department"]).font = { bold: true };
  for (const d of refs.departments) reference.addRow([d.companyCode, d.name]);
  reference.addRow([]);
  reference.addRow(["Positions"]).font = { bold: true, size: 12 };
  reference.addRow(["Company", "Position"]).font = { bold: true };
  for (const p of refs.positions) reference.addRow([p.companyCode ?? "(shared)", p.title]);
  reference.getColumn(1).width = 14;
  reference.getColumn(2).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export class ImportFileError extends Error {}

/**
 * Reads the uploaded workbook back into rows of trimmed strings.
 *
 * Columns are matched by header text, not position, so a sheet with columns
 * reordered or extras added still reads. A header from the template that is
 * missing is an error naming it — a silently blank required column would
 * otherwise produce one identical error per row.
 */
export async function parseEmployeeWorkbook(file: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file as unknown as ExcelJS.Buffer);
  } catch {
    throw new ImportFileError("That file could not be read as an Excel workbook (.xlsx).");
  }

  const sheet = workbook.getWorksheet(IMPORT_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) throw new ImportFileError("The workbook has no sheets.");

  const headerRow = sheet.getRow(1);
  const columnIndex = new Map<ImportColumnKey, number>();
  headerRow.eachCell((cell, index) => {
    const text = cellText(cell).toLowerCase();
    const column = IMPORT_COLUMNS.find((c) => c.header.toLowerCase() === text);
    if (column) columnIndex.set(column.key, index);
  });

  const missing = IMPORT_COLUMNS.filter((c) => c.required && !columnIndex.has(c.key));
  if (missing.length) {
    throw new ImportFileError(
      `These required columns are missing from the first row: ${missing
        .map((c) => `"${c.header}"`)
        .join(", ")}. Download the template and use its headers.`,
    );
  }

  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = {} as Record<ImportColumnKey, string>;
    let blank = true;
    for (const column of IMPORT_COLUMNS) {
      const index = columnIndex.get(column.key);
      const value = index === undefined ? "" : cellText(row.getCell(index));
      cells[column.key] = value;
      if (value) blank = false;
    }
    // Entirely empty rows are skipped rather than reported: Excel often
    // keeps rows that were once typed in and later cleared.
    if (!blank) rows.push({ rowNumber, cells });
  });

  if (rows.length === 0)
    throw new ImportFileError("The sheet has no employee rows below the header.");
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new ImportFileError(
      `The sheet has ${String(rows.length)} rows; at most ${String(IMPORT_MAX_ROWS)} can be imported at once. Split the file.`,
    );
  }
  return rows;
}

/**
 * A cell as the person saw it. Excel dates arrive as Date objects and are
 * written back in ISO; formulas contribute their result, never their text.
 * Nothing is escaped on the way in — a value is data here, and the export
 * path neutralises formula prefixes when it writes a spreadsheet out.
 */
export function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v)
      return v.richText
        .map((part) => part.text)
        .join("")
        .trim();
    if ("text" in v) return String(v.text).trim();
    if ("result" in v) {
      const r = v.result;
      if (r instanceof Date) return r.toISOString().slice(0, 10);
      if (typeof r === "string" || typeof r === "number" || typeof r === "boolean") {
        return String(r).trim();
      }
      // A formula that produced an error or a rich value: no usable text.
      return "";
    }
    if ("error" in v) return "";
    return "";
  }
  return String(v).trim();
}
