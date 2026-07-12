import type { EntityKind } from "@prisma/client";
import ExcelJS from "exceljs";
import { entityMeta, recordFromRow, xlsxHeadersFor } from "./registry";

const MAX_ROWS = 5000;

export async function buildTemplateWorkbook(kind: EntityKind): Promise<Buffer> {
  const meta = entityMeta(kind);
  const headers = xlsxHeadersFor(kind);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(meta.labelGr);

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };

  ws.columns = headers.map(() => ({ width: 20 }));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function parseEntityWorkbook(
  kind: EntityKind,
  buf: Buffer
): Promise<{
  rows: Record<string, unknown>[];
  rowNumbers: number[]; // αριθμός γραμμής xlsx ανά row (παράλληλο array)
  errors: { rowNumber: number; message: string }[];
}> {
  const expectedHeaders = xlsxHeadersFor(kind);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);

  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error("Το αρχείο δεν περιέχει φύλλο εργασίας");
  }

  const headerRow = ws.getRow(1);
  const actualHeaders: string[] = [];
  for (let i = 1; i <= expectedHeaders.length; i++) {
    actualHeaders.push(headerRow.getCell(i).text ?? "");
  }

  const headersMatch =
    actualHeaders.length === expectedHeaders.length &&
    actualHeaders.every((h, i) => h.trim() === expectedHeaders[i].trim());

  if (!headersMatch) {
    throw new Error(
      `Μη έγκυρες επικεφαλίδες στήλης. Αναμενόμενες: ${expectedHeaders.join(", ")}`
    );
  }

  const columns = entityMeta(kind).columns;
  const rows: Record<string, unknown>[] = [];
  const rowNumbers: number[] = [];
  const errors: { rowNumber: number; message: string }[] = [];
  const seenCodes = new Set<string>();

  const lastRowNumber = ws.actualRowCount ?? ws.rowCount;
  let dataRowCount = 0;

  for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber++) {
    const row = ws.getRow(rowNumber);

    const values: (string | number | boolean | null)[] = [];
    let isEmpty = true;
    for (let i = 1; i <= columns.length; i++) {
      const text = row.getCell(i).text ?? "";
      if (text.trim() !== "") isEmpty = false;
      values.push(text);
    }

    if (isEmpty) continue;

    dataRowCount++;
    if (dataRowCount > MAX_ROWS) {
      throw new Error(`Υπέρβαση μέγιστου αριθμού γραμμών (${MAX_ROWS})`);
    }

    try {
      const record = recordFromRow(kind, values);
      const code = record.code as string | undefined;
      if (code && seenCodes.has(code)) {
        errors.push({ rowNumber, message: `Διπλός κωδικός στο αρχείο: "${code}"` });
        continue;
      }
      if (code) seenCodes.add(code);
      rows.push(record);
      rowNumbers.push(rowNumber);
    } catch (err) {
      errors.push({ rowNumber, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { rows, rowNumbers, errors };
}
