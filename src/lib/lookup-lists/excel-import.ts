import ExcelJS from "exceljs";
import { planParentLinks, detectCycles } from "@/lib/entities/tree";

export type ParsedLookupItem = {
  value: string;
  label: string;
  order: number;
  /** Τιμή (value) του γονικού item, από τη στήλη «Γονικός Κωδικός». */
  parentValue: string | null;
};

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
