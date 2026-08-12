import "server-only";
import ExcelJS from "exceljs";
import { formatCell, neutraliseFormula, type CellValue } from "@/lib/export";
import type { ReportColumnSpec } from "@/lib/reports";

/**
 * Excel writer — ADR-003 (exceljs, not SheetJS).
 *
 * Values are written as TEXT after the same formula neutralisation the CSV
 * path uses. Writing a raw string into a `.xlsx` cell is not safe by virtue of
 * the format: Excel still evaluates a cell whose value begins `=`, and exceljs
 * will happily store one. The mitigation belongs at the value, not the format.
 */

type Row = Record<string, CellValue>;

export async function buildWorkbook(
  reportName: string,
  columns: readonly ReportColumnSpec[],
  rows: readonly Row[],
  meta: { generatedAt: Date; generatedBy: string; filters: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = meta.generatedAt;

  // Sheet names are capped at 31 characters by the format, and Excel rejects
  // these characters outright rather than sanitising them.
  const sheet = workbook.addWorksheet(reportName.replace(/[*?:/\\[\]]/g, "").slice(0, 31));

  // A header block, so a file that leaves this system still says what it is,
  // who ran it, and with which filters — an export with no provenance is how
  // stale numbers end up in a board pack.
  sheet.addRow([reportName]);
  sheet.addRow([`Generated ${meta.generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`]);
  sheet.addRow([`By ${meta.generatedBy}`]);
  sheet.addRow([meta.filters || "No filters applied"]);
  sheet.addRow([]);

  const titleRow = sheet.getRow(1);
  titleRow.font = { bold: true, size: 14 };

  const headerRow = sheet.addRow(columns.map((column) => column.header));
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };
  headerRow.border = { bottom: { style: "thin" } };

  for (const row of rows) {
    const values = columns.map((column) => neutraliseFormula(formatCell(row[column.key])));
    const added = sheet.addRow(values);

    columns.forEach((column, index) => {
      if (column.align === "right") {
        added.getCell(index + 1).alignment = { horizontal: "right" };
      }
    });
  }

  columns.forEach((column, index) => {
    const values = rows.map((row) => formatCell(row[column.key]).length);
    const widest = Math.max(column.header.length, ...values, 8);
    sheet.getColumn(index + 1).width = Math.min(widest + 2, 50);
  });

  sheet.views = [{ state: "frozen", ySplit: headerRow.number }];
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number + rows.length, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
