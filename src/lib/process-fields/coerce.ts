import type { FieldType } from "@prisma/client";

type Columns = {
  valueString?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | null;
  valueBool?: boolean | null;
  valueListItemId?: string | null;
};

export type CoerceResult =
  | { ok: true; columns: Columns }
  | { ok: false; error: string };

export function coerceFieldValue(type: FieldType, raw: string | null | undefined, required: boolean): CoerceResult {
  const v = (raw ?? "").toString().trim();
  if (v === "") {
    if (required) return { ok: false, error: "Υποχρεωτικό πεδίο" };
    switch (type) {
      case "NUMBER": return { ok: true, columns: { valueNumber: null } };
      case "DATE": return { ok: true, columns: { valueDate: null } };
      case "BOOLEAN": return { ok: true, columns: { valueBool: null } };
      case "SELECT": return { ok: true, columns: { valueListItemId: null } };
      default: return { ok: true, columns: { valueString: null } };
    }
  }
  switch (type) {
    case "NUMBER": {
      const n = Number(v);
      if (!Number.isFinite(n)) return { ok: false, error: "Μη έγκυρος αριθμός" };
      return { ok: true, columns: { valueNumber: n } };
    }
    case "DATE": {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Μη έγκυρη ημερομηνία" };
      return { ok: true, columns: { valueDate: d } };
    }
    case "BOOLEAN":
      return { ok: true, columns: { valueBool: v === "true" || v === "1" || v === "on" } };
    case "SELECT":
      return { ok: true, columns: { valueListItemId: v } };
    default:
      return { ok: true, columns: { valueString: v } };
  }
}
