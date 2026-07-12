/**
 * Άντληση οντοτήτων από WooCommerce REST API (read-only, Basic Auth όπως
 * στο src/lib/demo-connector-sample.ts). Οι JSON mappers είναι pure functions
 * (unit-tested στο sync.test.ts) — το δίκτυο μένει εκτός tests.
 */
import { getConnectorValues } from "@/lib/connectors/read";
import type { EntityKind } from "@prisma/client";
import type { SyncRow } from "./sync-types";

// ---------------------------------------------------------------------------
// Pure mappers
// ---------------------------------------------------------------------------

export type WooProductJson = { id: number; sku?: string; name?: string; price?: string; regular_price?: string };
export type WooCustomerJson = { id: number; first_name?: string; last_name?: string; email?: string };
export type WooTermJson = { id: number; slug?: string; name?: string };

function toNumber(s: string | undefined): number | null {
  if (!s || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Προϊόν: code = sku ή fallback στο id· τιμή λιανικής από regular_price ή price. */
export function mapWooProduct(p: WooProductJson): SyncRow {
  const extra: Record<string, unknown> = {};
  const price = toNumber(p.regular_price) ?? toNumber(p.price);
  if (price !== null) extra.priceRetail = price;
  return {
    externalId: String(p.id),
    code: p.sku && p.sku.trim() !== "" ? p.sku : String(p.id),
    name: p.name ?? "",
    extra,
  };
}

/** Πελάτης: code = id· όνομα = «first last» ή fallback στο email. */
export function mapWooCustomer(c: WooCustomerJson): SyncRow {
  const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || (c.email ?? "");
  const extra: Record<string, unknown> = {};
  if (c.email) extra.email = c.email;
  return { externalId: String(c.id), code: String(c.id), name, extra };
}

/** Κατηγορία προϊόντος: code = slug. */
export function mapWooCategory(t: WooTermJson): SyncRow {
  return { externalId: String(t.id), code: t.slug ?? String(t.id), name: t.name ?? "" };
}

/** Όρος attribute (χρώμα/μέγεθος): code = slug, name = name. */
export function mapWooAttributeTerm(t: WooTermJson): SyncRow {
  return { externalId: String(t.id), code: t.slug ?? String(t.id), name: t.name ?? "" };
}

// ---------------------------------------------------------------------------
// Fetcher (δίκτυο — δεν καλύπτεται από unit tests)
// ---------------------------------------------------------------------------

const PER_PAGE = 100;
const MAX_PAGES = 20;

const COLOR_RE = /colou?r|χρώμα/i;
const SIZE_RE = /size|μέγεθος/i;

type WooClient = { get: (path: string) => Promise<unknown> };

async function loadWooClient(): Promise<WooClient> {
  const c = await getConnectorValues("WOOCOMMERCE");
  if (!c?.enabled || !c.config.baseUrl || !c.secrets.consumerKey || !c.secrets.consumerSecret) {
    throw new Error("Ο connector WooCommerce δεν είναι ρυθμισμένος.");
  }
  const base = c.config.baseUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${c.secrets.consumerKey}:${c.secrets.consumerSecret}`).toString("base64");
  return {
    get: async (path: string) => {
      const sep = path.includes("?") ? "&" : "?";
      const res = await fetch(`${base}/wp-json/wc/v3${path}${sep}per_page=${PER_PAGE}`, {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`WooCommerce API: HTTP ${res.status} (${path})`);
      return res.json();
    },
  };
}

/** Σελιδοποιημένη άντληση: per_page=100, έως 20 σελίδες. */
async function fetchAllPages<T>(client: WooClient, path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = (await client.get(`${path}${sep}page=${page}`)) as T[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return out;
}

async function fetchAttributeTerms(client: WooClient, re: RegExp, labelGr: string): Promise<SyncRow[]> {
  const attrs = (await client.get("/products/attributes")) as { id: number; name?: string; slug?: string }[];
  const attr = attrs.find((a) => re.test(a.slug ?? "") || re.test(a.name ?? ""));
  if (!attr) throw new Error(`Δεν βρέθηκε attribute «${labelGr}» στο WooCommerce.`);
  const terms = await fetchAllPages<WooTermJson>(client, `/products/attributes/${attr.id}/terms`);
  return terms.map(mapWooAttributeTerm);
}

export async function fetchWooRows(kind: EntityKind): Promise<SyncRow[]> {
  const client = await loadWooClient();
  switch (kind) {
    case "CUSTOMER":
    case "SUPPLIER": {
      // Το Woo δεν έχει προμηθευτές — και τα δύο kinds αντλούν από /customers
      // (SUPPLIER καλείται μόνο αν το UI το επιτρέψει· κρατάμε τη συμπεριφορά ρητή).
      if (kind === "SUPPLIER") throw new Error("Το WooCommerce δεν παρέχει προμηθευτές.");
      const customers = await fetchAllPages<WooCustomerJson>(client, "/customers");
      return customers.map(mapWooCustomer).filter((r) => r.name !== "");
    }
    case "PRODUCT": {
      const products = await fetchAllPages<WooProductJson>(client, "/products");
      return products.map(mapWooProduct).filter((r) => r.name !== "");
    }
    case "PRODUCT_CATEGORY": {
      const cats = await fetchAllPages<WooTermJson>(client, "/products/categories");
      return cats.map(mapWooCategory).filter((r) => r.name !== "");
    }
    case "COLOR":
      return fetchAttributeTerms(client, COLOR_RE, "Χρώμα");
    case "SIZE":
      return fetchAttributeTerms(client, SIZE_RE, "Μέγεθος");
    default:
      throw new Error(`Μη υποστηριζόμενο είδος συγχρονισμού: ${kind}`);
  }
}
