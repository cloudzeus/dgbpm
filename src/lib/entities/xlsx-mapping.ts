/**
 * Pure helpers για το mapping στηλών xlsx → πεδία registry.
 * Χωρίς εξάρτηση από exceljs ώστε να φορτώνει και σε client components.
 */
import type { EntityKind } from "@prisma/client";
import { entityMeta } from "./registry";

export type WorkbookSheetInfo = {
  name: string;
  headers: string[];
  sampleRows: string[][]; // πρώτες 3 γραμμές δεδομένων
  rowCount: number; // μη κενές γραμμές δεδομένων
};

/** Normalize για ταίριασμα επικεφαλίδων: lowercase, χωρίς τόνους/σημεία στίξης. */
function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[*.\-_/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Συνώνυμα ανά κλειδί πεδίου (normalized). Το headerGr προστίθεται αυτόματα.
const FIELD_SYNONYMS: Record<string, string[]> = {
  code: ["code", "κωδικος", "sku"],
  name: ["name", "ονομα", "επωνυμια", "περιγραφη", "title", "τιτλος"],
  afm: ["afm", "αφμ", "α φ μ", "vat", "tax id"],
  email: ["email", "e mail", "ηλεκτρονικο ταχυδρομειο"],
  phone: ["phone", "τηλεφωνο", "τηλ", "κινητο", "mobile"],
  city: ["city", "πολη"],
  zip: ["zip", "τκ", "τ κ", "ταχυδρομικος κωδικας", "postal code", "postcode"],
  address: ["address", "διευθυνση", "οδος"],
  priceWholesale: ["τιμη χονδρικης", "χονδρικη", "wholesale", "wholesale price"],
  priceRetail: ["τιμη λιανικης", "λιανικη", "retail", "retail price", "price", "τιμη"],
  vatPct: ["φπα", "φπα %", "vat %", "vat pct", "vat rate"],
  unit: ["unit", "μοναδα", "μοναδα μετρησης", "μμ"],
  isActive: ["ενεργος", "ενεργο", "ενεργη", "active", "is active", "status", "κατασταση"],
  parentCode: ["γονικος κωδικος", "γονικος", "γονεας", "parent", "parent code", "κατηγορια γονεα"],
};

/**
 * Αυτόματη πρόταση mapping: field key → header φύλλου.
 * Case/accent-insensitive· κάθε header χρησιμοποιείται το πολύ μία φορά
 * (προτεραιότητα με τη σειρά στηλών του registry: code, name, μετά τα υπόλοιπα).
 */
export function suggestMapping(kind: EntityKind, headers: string[]): Record<string, string> {
  const columns = entityMeta(kind).columns;
  const normalized = headers.map((h) => normalizeHeader(h));
  const used = new Set<number>();
  const mapping: Record<string, string> = {};

  for (const col of columns) {
    const candidates = [normalizeHeader(col.headerGr), ...(FIELD_SYNONYMS[col.key] ?? [])];
    let matchIdx = -1;
    // 1ο πέρασμα: ακριβές ταίριασμα, 2ο: contains.
    for (const exact of [true, false]) {
      for (let i = 0; i < normalized.length && matchIdx === -1; i++) {
        if (used.has(i) || normalized[i] === "") continue;
        const h = normalized[i];
        const hit = candidates.some((c) =>
          exact ? h === c : h.includes(c) || (c.length >= 3 && c.includes(h) && h.length >= 3)
        );
        if (hit) matchIdx = i;
      }
      if (matchIdx !== -1) break;
    }
    if (matchIdx !== -1) {
      used.add(matchIdx);
      mapping[col.key] = headers[matchIdx];
    }
  }

  return mapping;
}
