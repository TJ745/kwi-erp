import "server-only";
import ExcelJS from "exceljs";
import {
  SALARY_COLUMNS,
  SALARY_MAX_ROWS,
  SALARY_SHEET_NAME,
  type SalaryColumnKey,
  type SalaryRow,
} from "@/lib/salary-import";
import { cellText, ImportFileError } from "./employee-workbook";

/**
 * The salary update workbook: pre-filled with every employee in scope and
 * their current salary, so the person only edits amounts.
 */
export async function buildSalaryTemplate(
  employees: {
    employeeNo: string;
    name: string;
    company: string;
    basic: number | null;
    transport: number | null;
    housing: number | null;
    other: number | null;
  }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(SALARY_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });

  const header = sheet.addRow(SALARY_COLUMNS.map((c) => c.header));
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  header.border = { bottom: { style: "thin" } };

  for (const e of employees) {
    // Written as plain string cells, which Excel never evaluates as formulas.
    sheet.addRow([e.employeeNo, e.name, e.company, e.basic, e.transport, e.housing, e.other]);
  }

  const widths = [14, 36, 10, 14, 16, 16, 22];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  for (let c = 4; c <= 7; c++) sheet.getColumn(c).numFmt = "#,##0.00";
  // Name and company are for reading; shade them so it is clear they are not
  // what the upload changes.
  for (let r = 2; r <= employees.length + 1; r++) {
    for (const c of [2, 3]) {
      sheet.getCell(r, c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF7F7F7" },
      };
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseSalaryWorkbook(file: Buffer): Promise<SalaryRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file as unknown as ExcelJS.Buffer);
  } catch {
    throw new ImportFileError("That file could not be read as an Excel workbook (.xlsx).");
  }
  const sheet = workbook.getWorksheet(SALARY_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) throw new ImportFileError("The workbook has no sheets.");

  const index = new Map<SalaryColumnKey, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const text = cellText(cell).toLowerCase();
    const column = SALARY_COLUMNS.find((c) => c.header.toLowerCase() === text);
    if (column) index.set(column.key, col);
  });
  const required: SalaryColumnKey[] = ["employeeNo", "basic", "transport", "housing", "other"];
  const missing = required.filter((k) => !index.has(k));
  if (missing.length) {
    throw new ImportFileError(
      `These columns are missing from the first row: ${missing
        .map((k) => `"${SALARY_COLUMNS.find((c) => c.key === k)?.header ?? k}"`)
        .join(", ")}. Download the template and use its headers.`,
    );
  }

  const rows: SalaryRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = {} as Record<SalaryColumnKey, string>;
    let blank = true;
    for (const column of SALARY_COLUMNS) {
      const col = index.get(column.key);
      const value = col === undefined ? "" : cellText(row.getCell(col));
      cells[column.key] = value;
      if (value) blank = false;
    }
    if (!blank) rows.push({ rowNumber, cells });
  });

  if (rows.length === 0) throw new ImportFileError("The sheet has no rows below the header.");
  if (rows.length > SALARY_MAX_ROWS) {
    throw new ImportFileError(
      `The sheet has ${String(rows.length)} rows; at most ${String(SALARY_MAX_ROWS)} at once.`,
    );
  }
  return rows;
}
