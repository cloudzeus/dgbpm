import type { EntityKind } from "@prisma/client";

export const ENTITY_KINDS: EntityKind[] = [
  "SUPPLIER", "CUSTOMER", "PRODUCT", "PRODUCT_CATEGORY", "BRAND", "COLOR", "SIZE",
];

export type EntityColumn = {
  key: string; // prisma field name
  headerGr: string; // xlsx/table header (χωρίς το "*")
  kind: "string" | "number" | "boolean";
  required?: boolean;
  /**
   * Εικονική στήλη xlsx (π.χ. «Γονικός Κωδικός»): συμμετέχει σε
   * rowFromRecord/recordFromRow αλλά ΔΕΝ είναι πεδίο Prisma — τα CRUD
   * validation/upserts πρέπει να την αγνοούν.
   */
  virtual?: true;
};

/** Κλειδιά εικονικών στηλών του kind (πρέπει να αφαιρούνται πριν από prisma writes). */
export function virtualColumnKeys(kind: EntityKind): Set<string> {
  return new Set(entityMeta(kind).columns.filter((c) => c.virtual).map((c) => c.key));
}

export type EntityMeta = {
  kind: EntityKind;
  labelGr: string; // «Προμηθευτές» κλπ.
  labelSingularGr: string;
  prismaModel: "supplier" | "customer" | "product" | "productCategory" | "brand" | "color" | "size";
  columns: EntityColumn[]; // ordered· τα πρώτα δύο πάντα code, name
};

const BASE_COLUMNS: EntityColumn[] = [
  { key: "code", headerGr: "Κωδικός", kind: "string", required: true },
  { key: "name", headerGr: "Όνομα", kind: "string", required: true },
];

const CONTACT_COLUMNS: EntityColumn[] = [
  { key: "afm", headerGr: "ΑΦΜ", kind: "string" },
  { key: "address", headerGr: "Διεύθυνση", kind: "string" },
  { key: "city", headerGr: "Πόλη", kind: "string" },
  { key: "zip", headerGr: "ΤΚ", kind: "string" },
  { key: "phone", headerGr: "Τηλέφωνο", kind: "string" },
  { key: "email", headerGr: "Email", kind: "string" },
];

const PRODUCT_COLUMNS: EntityColumn[] = [
  { key: "priceWholesale", headerGr: "Τιμή χονδρικής", kind: "number" },
  { key: "priceRetail", headerGr: "Τιμή λιανικής", kind: "number" },
  { key: "vatPct", headerGr: "ΦΠΑ %", kind: "number" },
  { key: "unit", headerGr: "Μονάδα μέτρησης", kind: "string" },
  { key: "imageUrl", headerGr: "Εικόνα (URL)", kind: "string" },
];

const IS_ACTIVE_COLUMN: EntityColumn = { key: "isActive", headerGr: "Ενεργός", kind: "boolean" };

const META: Record<EntityKind, EntityMeta> = {
  SUPPLIER: {
    kind: "SUPPLIER",
    labelGr: "Προμηθευτές",
    labelSingularGr: "Προμηθευτής",
    prismaModel: "supplier",
    columns: [...BASE_COLUMNS, IS_ACTIVE_COLUMN, ...CONTACT_COLUMNS],
  },
  CUSTOMER: {
    kind: "CUSTOMER",
    labelGr: "Πελάτες",
    labelSingularGr: "Πελάτης",
    prismaModel: "customer",
    columns: [...BASE_COLUMNS, IS_ACTIVE_COLUMN, ...CONTACT_COLUMNS],
  },
  PRODUCT: {
    kind: "PRODUCT",
    labelGr: "Προϊόντα",
    labelSingularGr: "Προϊόν",
    prismaModel: "product",
    columns: [...BASE_COLUMNS, IS_ACTIVE_COLUMN, ...PRODUCT_COLUMNS],
  },
  PRODUCT_CATEGORY: {
    kind: "PRODUCT_CATEGORY",
    labelGr: "Κατηγορίες προϊόντων",
    labelSingularGr: "Κατηγορία προϊόντος",
    prismaModel: "productCategory",
    columns: [
      ...BASE_COLUMNS,
      IS_ACTIVE_COLUMN,
      // Εικονική στήλη xlsx για ιεραρχία — δεν είναι DB πεδίο.
      { key: "parentCode", headerGr: "Γονικός Κωδικός", kind: "string", virtual: true },
    ],
  },
  BRAND: {
    kind: "BRAND",
    labelGr: "Brands",
    labelSingularGr: "Brand",
    prismaModel: "brand",
    columns: [...BASE_COLUMNS, IS_ACTIVE_COLUMN],
  },
  COLOR: {
    kind: "COLOR",
    labelGr: "Χρώματα",
    labelSingularGr: "Χρώμα",
    prismaModel: "color",
    columns: [...BASE_COLUMNS, IS_ACTIVE_COLUMN],
  },
  SIZE: {
    kind: "SIZE",
    labelGr: "Μεγέθη",
    labelSingularGr: "Μέγεθος",
    prismaModel: "size",
    columns: [...BASE_COLUMNS, IS_ACTIVE_COLUMN],
  },
};

export function entityMeta(kind: EntityKind): EntityMeta {
  return META[kind];
}

export function xlsxHeadersFor(kind: EntityKind): string[] {
  return entityMeta(kind).columns.map((c) => (c.required ? `${c.headerGr}*` : c.headerGr));
}

type EntityRecord = Record<string, string | number | boolean | null | undefined>;

export function rowFromRecord(kind: EntityKind, rec: EntityRecord): (string | number | boolean | null)[] {
  const columns = entityMeta(kind).columns;
  return columns.map((c) => {
    const v = rec[c.key];
    if (v === undefined || v === null) return null;
    return v;
  });
}

function parseNumberGr(raw: string): number {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Μη έγκυρος αριθμός: "${raw}"`);
  return n;
}

function parseBooleanGr(raw: string): boolean {
  const v = raw.trim().toUpperCase();
  if (v === "") return true;
  if (["TRUE", "1", "ΝΑΙ"].includes(v)) return true;
  if (["FALSE", "0", "ΟΧΙ", "ΌΧΙ"].includes(v)) return false;
  throw new Error(`Μη έγκυρη τιμή Ναι/Όχι: "${raw}"`);
}

export function recordFromRow(kind: EntityKind, row: (string | number | boolean | null | undefined)[]): EntityRecord {
  const columns = entityMeta(kind).columns;
  const rec: EntityRecord = {};

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const raw = row[i];
    const str = raw === null || raw === undefined ? "" : String(raw).trim();

    if (col.required && str === "") {
      throw new Error(`Το πεδίο «${col.headerGr}» είναι υποχρεωτικό`);
    }

    if (str === "") {
      rec[col.key] = col.kind === "boolean" ? true : null;
      continue;
    }

    switch (col.kind) {
      case "number":
        rec[col.key] = parseNumberGr(str);
        break;
      case "boolean":
        rec[col.key] = parseBooleanGr(str);
        break;
      default:
        rec[col.key] = str;
    }
  }

  return rec;
}
