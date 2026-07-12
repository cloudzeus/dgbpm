/**
 * Άντληση οντοτήτων από SoftOne ERP — ΜΟΝΟ επίσημα S1 Web Services.
 * Ροή: login → authenticate (clientID cached σε module scope) → getBrowserInfo → getBrowserData.
 * ΚΑΘΕ απόκριση αποκωδικοποιείται: arrayBuffer → gunzip (αν gzip) → win1253 → JSON.
 * Οι row-mappers είναι pure functions (unit-tested στο sync.test.ts) — το δίκτυο μένει εκτός tests.
 */
import iconv from "iconv-lite";
import { gunzipSync } from "node:zlib";
import { getConnectorValues } from "@/lib/connectors/read";
import type { SyncRow } from "./sync-types";

export type SoftoneSyncKind = "SUPPLIER" | "CUSTOMER" | "PRODUCT" | "PRODUCT_CATEGORY";

// ---------------------------------------------------------------------------
// Pure mappers — δέχονται τη λίστα στηλών του browser (π.χ. "TRDR.CODE") + το row (array).
// ---------------------------------------------------------------------------

/**
 * Βρίσκει index στήλης: προτιμά exact match στο κύριο table του object
 * (π.χ. "MTRL.CODE" για ITEM ώστε να μην κερδίσει το "MTRUNIT.CODE"),
 * αλλιώς fallback σε ταίριασμα του ονόματος πεδίου ΜΕΤΑ την τελευταία τελεία.
 * Πάντα case-insensitive.
 */
function colIndex(columns: string[], mainTable: string, field: string): number {
  const exact = `${mainTable}.${field}`.toLowerCase();
  const exactIdx = columns.findIndex((c) => c.toLowerCase() === exact);
  if (exactIdx >= 0) return exactIdx;
  const f = field.toLowerCase();
  return columns.findIndex((c) => {
    const tail = c.slice(c.lastIndexOf(".") + 1).toLowerCase();
    return tail === f;
  });
}

function cell(columns: string[], row: unknown[], mainTable: string, field: string): string {
  const i = colIndex(columns, mainTable, field);
  if (i < 0) return "";
  const v = row[i];
  return v === null || v === undefined ? "" : String(v).trim();
}

/** ISACTIVE → boolean: "1"/1/true → true, "0"/0/false → false, στήλη απούσα/κενή → undefined. */
function cellIsActive(columns: string[], row: unknown[], mainTable: string): boolean | undefined {
  if (colIndex(columns, mainTable, "ISACTIVE") < 0) return undefined;
  const s = cell(columns, row, mainTable, "ISACTIVE").toLowerCase();
  if (s === "1" || s === "true") return true;
  if (s === "0" || s === "false") return false;
  return undefined;
}

function cellNumber(columns: string[], row: unknown[], mainTable: string, field: string): number | null {
  const s = cell(columns, row, mainTable, field);
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** TRDR (CUSTOMER/SUPPLIER): externalId=TRDR, extras afm/address/city/zip/phone/email. */
export function mapSoftoneTrdrRow(columns: string[], row: unknown[]): SyncRow {
  const T = "TRDR";
  const externalId = cell(columns, row, T, "TRDR");
  const extra: Record<string, unknown> = {};
  const pairs: [string, string][] = [
    ["afm", "AFM"], ["address", "ADDRESS"], ["city", "CITY"],
    ["zip", "ZIP"], ["phone", "PHONE01"], ["email", "EMAIL"],
  ];
  for (const [key, field] of pairs) {
    const v = cell(columns, row, T, field);
    if (v !== "") extra[key] = v;
  }
  const isActive = cellIsActive(columns, row, T);
  return {
    externalId,
    code: cell(columns, row, T, "CODE") || externalId,
    name: cell(columns, row, T, "NAME"),
    extra,
    ...(isActive !== undefined ? { isActive } : {}),
  };
}

/** ITEM: externalId=MTRL, extras priceWholesale (PRICEW) / priceRetail (PRICER). */
export function mapSoftoneItemRow(columns: string[], row: unknown[]): SyncRow {
  const T = "MTRL";
  const externalId = cell(columns, row, T, "MTRL");
  const extra: Record<string, unknown> = {};
  const pricew = cellNumber(columns, row, T, "PRICEW");
  const pricer = cellNumber(columns, row, T, "PRICER");
  if (pricew !== null) extra.priceWholesale = pricew;
  if (pricer !== null) extra.priceRetail = pricer;
  const isActive = cellIsActive(columns, row, T);
  return {
    externalId,
    code: cell(columns, row, T, "CODE") || externalId,
    name: cell(columns, row, T, "NAME"),
    extra,
    ...(isActive !== undefined ? { isActive } : {}),
  };
}

/** ITECATEGORY: externalId=MTRCATEGORY, code=CODE ή fallback στο κλειδί. */
export function mapSoftoneCategoryRow(columns: string[], row: unknown[]): SyncRow {
  const T = "MTRCATEGORY";
  const externalId = cell(columns, row, T, "MTRCATEGORY");
  return {
    externalId,
    code: cell(columns, row, T, "CODE") || externalId,
    name: cell(columns, row, T, "NAME"),
  };
}

// ---------------------------------------------------------------------------
// Fetcher (δίκτυο — δεν καλύπτεται από unit tests)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 500;
const MAX_ROWS = 5000;

const OBJECT_FOR: Record<SoftoneSyncKind, string> = {
  SUPPLIER: "SUPPLIER",
  CUSTOMER: "CUSTOMER",
  PRODUCT: "ITEM",
  PRODUCT_CATEGORY: "ITECATEGORY",
};

type S1Config = {
  baseUrl: string;
  username: string;
  password: string;
  appId: string;
  company: string;
  branch?: string;
  module?: string;
  refid?: string;
};

/** clientID cache: μία αυθεντικοποίηση ανά process (re-auth σε errorcode -100/-101). */
let cachedClientId: string | null = null;

async function s1Fetch(baseUrl: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let buf = Buffer.from(await res.arrayBuffer());
  if ((res.headers.get("content-encoding") ?? "").includes("gzip")) {
    try {
      buf = gunzipSync(buf);
    } catch {
      // Το runtime μπορεί να έχει ήδη αποσυμπιέσει το σώμα — συνέχισε με το raw buffer.
    }
  }
  return JSON.parse(iconv.decode(buf, "win1253")) as Record<string, unknown>;
}

async function loadSoftoneConfig(): Promise<S1Config> {
  const c = await getConnectorValues("SOFTONE");
  if (
    !c?.enabled ||
    !c.config.serial ||
    !c.config.username ||
    !c.secrets.password ||
    !c.secrets.appId ||
    !c.config.company
  ) {
    throw new Error("Ο connector SoftOne δεν είναι ρυθμισμένος.");
  }
  return {
    baseUrl: `https://${c.config.serial}.oncloud.gr/s1services`,
    username: c.config.username,
    password: c.secrets.password,
    appId: c.secrets.appId,
    company: c.config.company,
    branch: c.config.branch,
    module: c.config.module,
    refid: c.config.refid,
  };
}

async function authenticate(cfg: S1Config): Promise<string> {
  const login = await s1Fetch(cfg.baseUrl, {
    SERVICE: "Login",
    USERNAME: cfg.username,
    PASSWORD: cfg.password,
    APPID: cfg.appId,
    VERSION: "2",
  });
  if (!login.success) throw new Error(`SoftOne login: ${login.error ?? "άγνωστο σφάλμα"}`);
  const auth = await s1Fetch(cfg.baseUrl, {
    service: "authenticate",
    clientID: login.clientID,
    COMPANY: cfg.company,
    BRANCH: cfg.branch ?? "",
    MODULE: cfg.module ?? "",
    REFID: cfg.refid ?? "",
    VERSION: "2",
  });
  if (!auth.success) throw new Error(`SoftOne authenticate: ${auth.error ?? "άγνωστο σφάλμα"}`);
  cachedClientId = String(auth.clientID);
  return cachedClientId;
}

/** Κλήση service με auto re-auth σε ληγμένο session (-100/-101). */
async function s1Call(cfg: S1Config, service: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const clientID = cachedClientId ?? (await authenticate(cfg));
  const data = await s1Fetch(cfg.baseUrl, { service, clientID, appId: cfg.appId, VERSION: "2", ...params });
  const errorcode = data.errorcode as number | undefined;
  if (!data.success && (errorcode === -101 || errorcode === -100)) {
    cachedClientId = null;
    const fresh = await authenticate(cfg);
    return s1Fetch(cfg.baseUrl, { service, clientID: fresh, appId: cfg.appId, VERSION: "2", ...params });
  }
  return data;
}

export async function fetchSoftoneRows(kind: SoftoneSyncKind): Promise<SyncRow[]> {
  const cfg = await loadSoftoneConfig();
  const object = OBJECT_FOR[kind];

  // getBrowserInfo: εκτελεί το default browser query του object → reqID + μεταδεδομένα στηλών.
  const info = await s1Call(cfg, "getBrowserInfo", { OBJECT: object, LIST: "", VERSION: "2" });
  if (!info.success) throw new Error(`SoftOne getBrowserInfo(${object}): ${info.error ?? "άγνωστο σφάλμα"}`);
  const reqID = info.reqID as string;
  const total = Number(info.totalcount ?? 0);
  const fields = (info.fields as { name: string }[] | undefined) ?? [];
  const columns = fields.map((f) => f.name);

  const rows: SyncRow[] = [];
  const limit = Math.min(total || MAX_ROWS, MAX_ROWS);
  for (let start = 0; start < limit; start += PAGE_SIZE) {
    const page = await s1Call(cfg, "getBrowserData", { reqID, START: start, LIMIT: PAGE_SIZE, VERSION: "2" });
    if (!page.success) throw new Error(`SoftOne getBrowserData(${object}): ${page.error ?? "άγνωστο σφάλμα"}`);
    const raw = (page.rows as unknown[][] | undefined) ?? [];
    if (raw.length === 0) break;
    for (const r of raw) {
      if (kind === "PRODUCT") rows.push(mapSoftoneItemRow(columns, r));
      else if (kind === "PRODUCT_CATEGORY") rows.push(mapSoftoneCategoryRow(columns, r));
      else rows.push(mapSoftoneTrdrRow(columns, r));
    }
    if (raw.length < PAGE_SIZE) break;
  }

  // Πέτα rows χωρίς externalId ή name — δεν μπορούν να γίνουν upsert με ασφάλεια.
  return rows.filter((r) => r.externalId !== "" && r.name !== "");
}
