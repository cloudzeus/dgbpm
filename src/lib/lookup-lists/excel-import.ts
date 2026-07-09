import ExcelJS from "exceljs";

export type ParsedLookupItem = { value: string; label: string; order: number };

/** First sheet, row 1 is a header (skipped). Col A = value, Col B = label (defaults to value). */
export async function parseLookupItemsFromWorkbook(buf: ArrayBuffer): Promise<ParsedLookupItem[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const items: ParsedLookupItem[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const value = String(row.getCell(1).value ?? "").trim();
    const label = String(row.getCell(2).value ?? "").trim() || value;
    if (!value) return;
    items.push({ value, label, order: items.length });
  });
  return items;
}
