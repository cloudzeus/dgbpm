import type { FieldType } from "@prisma/client";

export const FIELD_TYPES: FieldType[] = [
  "STRING", "TEXT", "NUMBER", "DATE", "FILE_URL", "BOOLEAN", "SELECT",
];

const LABELS: Record<FieldType, string> = {
  STRING: "Κείμενο (σύντομο)",
  TEXT: "Κείμενο (μεγάλο)",
  NUMBER: "Αριθμός",
  DATE: "Ημερομηνία",
  FILE_URL: "Αρχείο (URL)",
  BOOLEAN: "Ναι/Όχι",
  SELECT: "Λίστα τιμών",
};

export function fieldTypeLabel(t: FieldType): string {
  return LABELS[t];
}

export type ValueColumn =
  | "valueString" | "valueNumber" | "valueDate" | "valueBool" | "valueListItemId";

export function valueColumnFor(t: FieldType): ValueColumn {
  switch (t) {
    case "NUMBER": return "valueNumber";
    case "DATE": return "valueDate";
    case "BOOLEAN": return "valueBool";
    case "SELECT": return "valueListItemId";
    default: return "valueString"; // STRING, TEXT, FILE_URL
  }
}
