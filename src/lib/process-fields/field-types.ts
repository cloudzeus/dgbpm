import type { EntityKind, FieldType } from "@prisma/client";

export const FIELD_TYPES: FieldType[] = [
  "STRING", "TEXT", "NUMBER", "DATE", "FILE_URL", "BOOLEAN", "SELECT", "ENTITY",
];

const LABELS: Record<FieldType, string> = {
  STRING: "Κείμενο (σύντομο)",
  TEXT: "Κείμενο (μεγάλο)",
  NUMBER: "Αριθμός",
  DATE: "Ημερομηνία",
  FILE_URL: "Αρχείο (URL)",
  BOOLEAN: "Ναι/Όχι",
  SELECT: "Λίστα τιμών",
  ENTITY: "Οντότητα",
};

export function fieldTypeLabel(t: FieldType): string {
  return LABELS[t];
}

export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  SUPPLIER: "Προμηθευτής",
  CUSTOMER: "Πελάτης",
  PRODUCT: "Προϊόν",
  PRODUCT_CATEGORY: "Κατηγορία προϊόντος",
  COLOR: "Χρώμα",
  SIZE: "Μέγεθος",
};

export type ValueColumn =
  | "valueString" | "valueNumber" | "valueDate" | "valueBool" | "valueListItemId" | "valueEntityId";

export function valueColumnFor(t: FieldType): ValueColumn {
  switch (t) {
    case "NUMBER": return "valueNumber";
    case "DATE": return "valueDate";
    case "BOOLEAN": return "valueBool";
    case "SELECT": return "valueListItemId";
    case "ENTITY": return "valueEntityId";
    default: return "valueString"; // STRING, TEXT, FILE_URL
  }
}
