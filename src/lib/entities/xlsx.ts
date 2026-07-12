import type { EntityKind } from "@prisma/client";
import ExcelJS from "exceljs";
import { entityMeta, recordFromRow, xlsxHeadersFor } from "./registry";

const MAX_ROWS = 5000;

export type ParsedSheet = {
  rows: Record<string, unknown>[];
  rowNumbers: number[]; // αριθμός γραμμής xlsx ανά row (παράλληλο array)
  errors: { rowNumber: number; message: string }[];
};

export { suggestMapping, type WorkbookSheetInfo } from "./xlsx-mapping";
import type { WorkbookSheetInfo } from "./xlsx-mapping";

/** Σκανάρει όλα τα φύλλα: επικεφαλίδες, δείγμα 3 γραμμών, πλήθος γραμμών. */
export async function analyzeWorkbook(buf: Buffer): Promise<{ sheets: WorkbookSheetInfo[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  if (wb.worksheets.length === 0) {
    throw new Error("Το αρχείο δεν περιέχει φύλλο εργασίας");
  }

  const sheets: WorkbookSheetInfo[] = wb.worksheets.map((ws) => {
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    const colCount = ws.actualColumnCount ?? ws.columnCount;
    for (let i = 1; i <= colCount; i++) {
      const text = (headerRow.getCell(i).text ?? "").trim();
      headers.push(text);
    }
    // κόψε trailing κενές επικεφαλίδες
    while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();

    const sampleRows: string[][] = [];
    let rowCount = 0;
    const lastRowNumber = ws.actualRowCount ?? ws.rowCount;
    for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber++) {
      const row = ws.getRow(rowNumber);
      const values: string[] = [];
      let isEmpty = true;
      for (let i = 1; i <= headers.length; i++) {
        const text = row.getCell(i).text ?? "";
        if (text.trim() !== "") isEmpty = false;
        values.push(text);
      }
      if (isEmpty) continue;
      rowCount++;
      if (sampleRows.length < 3) sampleRows.push(values);
    }

    return { name: ws.name, headers, sampleRows, rowCount };
  });

  return { sheets };
}

/**
 * Parse φύλλου με χειροκίνητο mapping (field key → header).
 * Απαιτεί code+name mapped· unmapped optional πεδία = κενό κελί.
 * Ίδια σημασιολογία με parseEntityWorkbook (recordFromRow, διπλοί κωδικοί, MAX_ROWS).
 */
export async function parseSheetWithMapping(
  kind: EntityKind,
  buf: Buffer,
  sheetName: string,
  mapping: Record<string, string>
): Promise<ParsedSheet> {
  const columns = entityMeta(kind).columns;
  const columnKeys = new Set(columns.map((c) => c.key));

  for (const key of Object.keys(mapping)) {
    if (!columnKeys.has(key)) {
      throw new Error(`Άγνωστο πεδίο mapping: "${key}"`);
    }
  }
  if (!mapping.code || !mapping.name) {
    throw new Error("Απαιτείται αντιστοίχιση για τα πεδία «Κωδικός» και «Όνομα»");
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets.find((w) => w.name === sheetName);
  if (!ws) {
    throw new Error(`Δεν βρέθηκε φύλλο εργασίας «${sheetName}»`);
  }

  // header name → column index (1-based)
  const headerRow = ws.getRow(1);
  const headerIndex = new Map<string, number>();
  const colCount = ws.actualColumnCount ?? ws.columnCount;
  for (let i = 1; i <= colCount; i++) {
    const text = (headerRow.getCell(i).text ?? "").trim();
    if (text !== "" && !headerIndex.has(text)) headerIndex.set(text, i);
  }

  // field key → column index του φύλλου (ή null αν unmapped)
  const cellIndexByField: (number | null)[] = columns.map((col) => {
    const header = mapping[col.key];
    if (header === undefined || header === "") return null;
    const idx = headerIndex.get(header.trim());
    if (idx === undefined) {
      throw new Error(`Η στήλη «${header}» δεν υπάρχει στο φύλλο «${sheetName}»`);
    }
    return idx;
  });

  const rows: Record<string, unknown>[] = [];
  const rowNumbers: number[] = [];
  const errors: { rowNumber: number; message: string }[] = [];
  const seenCodes = new Set<string>();

  const lastRowNumber = ws.actualRowCount ?? ws.rowCount;
  let dataRowCount = 0;

  for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber++) {
    const row = ws.getRow(rowNumber);

    // Χτίσε row σε σειρά στηλών registry από τα mapped κελιά.
    const values: (string | null)[] = [];
    let isEmpty = true;
    for (const idx of cellIndexByField) {
      if (idx === null) {
        values.push(null);
        continue;
      }
      const text = row.getCell(idx).text ?? "";
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
