/**
 * Δείγματα πραγματικών ονομάτων πελατών/προϊόντων από ενεργές διασυνδέσεις,
 * για ρεαλιστικές τιμές στα demo custom πεδία. Read-only & best-effort:
 * οποιοδήποτε σφάλμα → σιωπηλό fallback στα τοπικά pools.
 */
import { getConnectorValues } from "@/lib/connectors/read";

export type SamplePools = { customers: string[]; products: string[] };

export const FALLBACK_POOLS: SamplePools = {
  customers: [
    "ΑΦΟΙ Παπαδόπουλοι ΟΕ", "Ελληνικά Τρόφιμα ΑΕ", "TechnoServe ΕΠΕ", "Δίκτυο Λογιστικής ΙΚΕ",
    "Μεταφορική Αιγαίου ΑΕ", "Κατασκευαστική Ήλιος ΟΕ", "Φαρμακείο Νίκη", "Ξενοδοχεία Κύμα ΑΕ",
  ],
  products: [
    "Εκτυπωτής HP LaserJet", "Φορητός Η/Υ Dell Latitude", "Γραφείο εργασίας 160cm",
    "Λογισμικό ERP - ετήσια άδεια", "Οθόνη 27'' 4K", "Καρέκλα γραφείου εργονομική",
    "Πολυμηχάνημα Canon", "Server Rack 42U",
  ],
};

const LIMIT = 40;
const TIMEOUT_MS = 8000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

async function sampleWoo(): Promise<Partial<SamplePools>> {
  const c = await getConnectorValues("WOOCOMMERCE");
  if (!c?.enabled || !c.config.baseUrl || !c.secrets.consumerKey || !c.secrets.consumerSecret) return {};
  const auth = Buffer.from(`${c.secrets.consumerKey}:${c.secrets.consumerSecret}`).toString("base64");
  const get = async (path: string) => {
    const res = await withTimeout(
      fetch(`${c.config.baseUrl.replace(/\/$/, "")}/wp-json/wc/v3${path}`, {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      }),
    );
    if (!res.ok) throw new Error(`woo ${res.status}`);
    return res.json();
  };
  const out: Partial<SamplePools> = {};
  try {
    const products = (await get(`/products?per_page=${LIMIT}&_fields=name`)) as { name?: string }[];
    out.products = products.map((p) => p.name).filter((n): n is string => !!n);
  } catch { /* αγνόησε */ }
  try {
    const customers = (await get(`/customers?per_page=${LIMIT}&_fields=first_name,last_name`)) as
      { first_name?: string; last_name?: string }[];
    out.customers = customers
      .map((c) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim())
      .filter(Boolean);
  } catch { /* αγνόησε */ }
  return out;
}

// SoftOne: παραλείπεται σκόπιμα στην v1 (απαιτεί πλήρη ροή login/authenticate/
// GetTable με win1253 αποκωδικοποίηση). Αν προστεθεί, ΜΟΝΟ επίσημα S1 services.

// Προτεραιότητα δειγματοληψίας: τοπικές οντότητες (Customer/Product) → Woo → fallback pools.
// Οι τοπικές οντότητες αντιπροσωπεύουν τα πραγματικά δεδομένα του tenant, οπότε αν υπάρχουν
// ενεργές εγγραφές τοπικά, προηγούνται της κλήσης προς το WooCommerce (και την αποφεύγουν).
export async function buildSamplePools(): Promise<SamplePools> {
  const pools: SamplePools = { customers: [...FALLBACK_POOLS.customers], products: [...FALLBACK_POOLS.products] };

  let hasLocalCustomers = false;
  let hasLocalProducts = false;
  try {
    const { prisma } = await import("@/lib/prisma");
    const [customers, products] = await Promise.all([
      prisma.customer.findMany({ where: { isActive: true }, select: { name: true }, take: LIMIT }),
      prisma.product.findMany({ where: { isActive: true }, select: { name: true }, take: LIMIT }),
    ]);
    if (customers.length) {
      pools.customers = customers.map((c) => c.name).filter(Boolean);
      hasLocalCustomers = true;
    }
    if (products.length) {
      pools.products = products.map((p) => p.name).filter(Boolean);
      hasLocalProducts = true;
    }
  } catch { /* σφάλμα DB → συνέχισε στο Woo/fallback */ }

  if (hasLocalCustomers && hasLocalProducts) return pools;

  try {
    const woo = await sampleWoo();
    if (!hasLocalCustomers && woo.customers?.length) pools.customers = woo.customers;
    if (!hasLocalProducts && woo.products?.length) pools.products = woo.products;
  } catch { /* fallback */ }
  return pools;
}
