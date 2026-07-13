import ExcelJS from "exceljs";
import { planParentLinks, detectCycles } from "@/lib/entities/tree";

export type ParsedLookupItem = {
  value: string;
  label: string;
  order: number;
  /** Τιμή (value) του γονικού item, από τη στήλη «Γονικός Κωδικός». */
  parentValue: string | null;
};

export type LookupSheetMapping = {
  value: string;
  /** Αν λείπει ή ταυτίζεται με value, label = value. */
  label?: string;
  parent?: string;
};

/**
 * Parse φύλλου με ρητό mapping στηλών (header → ρόλος).
 * Γραμμή 1 = επικεφαλίδες· κενές γραμμές (χωρίς value) παραλείπονται.
 */
export async function parseLookupSheet(
  buf: Buffer,
  sheetName: string,
  mapping: LookupSheetMapping
): Promise<{ value: string; label: string; parent: string | null }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets.find((w) => w.name === sheetName) ?? wb.worksheets[0];
  if (!ws) throw new Error("Το αρχείο δεν περιέχει φύλλο εργασίας");

  const headerRow = ws.getRow(1);
  const headerIndex = new Map<string, number>();
  const colCount = ws.actualColumnCount ?? ws.columnCount;
  for (let i = 1; i <= colCount; i++) {
    const text = (headerRow.getCell(i).text ?? "").trim();
    if (text !== "" && !headerIndex.has(text)) headerIndex.set(text, i);
  }

  const idxOf = (header: string | undefined, role: string): number | null => {
    if (!header || header.trim() === "") return null;
    const idx = headerIndex.get(header.trim());
    if (idx === undefined) throw new Error(`Η στήλη «${header}» (${role}) δεν υπάρχει στο φύλλο «${ws.name}»`);
    return idx;
  };

  const valueIdx = idxOf(mapping.value, "Τιμή");
  if (valueIdx === null) throw new Error("Απαιτείται αντιστοίχιση για τη στήλη «Τιμή»");
  const labelIdx = idxOf(mapping.label, "Ετικέτα");
  const parentIdx = idxOf(mapping.parent, "Γονέας");

  const rows: { value: string; label: string; parent: string | null }[] = [];
  const lastRowNumber = ws.actualRowCount ?? ws.rowCount;
  for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const value = (row.getCell(valueIdx).text ?? "").trim();
    if (!value) continue;
    const label = labelIdx !== null ? (row.getCell(labelIdx).text ?? "").trim() || value : value;
    const parent = parentIdx !== null ? (row.getCell(parentIdx).text ?? "").trim() || null : null;
    rows.push({ value, label, parent });
  }
  return rows;
}

/**
 * First sheet, row 1 is a header (skipped). Col A = value, Col B = label (defaults to value).
 * Προαιρετική στήλη «Γονικός Κωδικός» (αναγνωρίζεται από τον header, αλλιώς στήλη C):
 * οι τιμές της αντιστοιχούν σε value άλλης γραμμής (η σειρά ορισμού ΔΕΝ μετράει).
 */
export async function parseLookupItemsFromWorkbook(buf: ArrayBuffer): Promise<ParsedLookupItem[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // Εντόπισε τη στήλη «Γονικός Κωδικός» από τον header (fallback: στήλη 3).
  let parentCol = 3;
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const text = String(cell.value ?? "").trim().toLowerCase();
    if (text.includes("γονικ") || text.includes("parent")) parentCol = colNumber;
  });

  const items: ParsedLookupItem[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const value = String(row.getCell(1).value ?? "").trim();
    const label = String(row.getCell(2).value ?? "").trim() || value;
    const parentValue = String(row.getCell(parentCol).value ?? "").trim() || null;
    if (!value) return;
    items.push({ value, label, order: items.length, parentValue });
  });
  return items;
}

/**
 * Πάσο-2 έλεγχος ιεραρχίας: άγνωστοι γονικοί κωδικοί και κύκλοι
 * (συμπερ. self-parent) → ελληνικά μηνύματα ανά γραμμή. Δεν κόβει τις υπόλοιπες.
 */
export function validateLookupHierarchy(
  items: ParsedLookupItem[]
): { value: string; message: string }[] {
  const byCode = new Map(items.map((it) => [it.value, it.value]));
  const { links, errors } = planParentLinks(
    items.map((it) => ({ code: it.value, parentCode: it.parentValue })),
    byCode
  );
  const parentOf = new Map(links.map((l) => [l.code, l.parentId]));
  const cycleIds = detectCycles(
    items.map((it) => ({ id: it.value, parentId: parentOf.get(it.value) ?? null }))
  );
  const out = errors.map((e) => ({ value: e.code, message: e.message }));
  for (const id of cycleIds) {
    out.push({ value: id, message: "Ο γονέας δεν μπορεί να είναι απόγονος." });
  }
  return out;
}
