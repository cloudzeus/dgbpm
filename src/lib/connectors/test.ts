import iconv from "iconv-lite";
import type { ConnectorType } from "@prisma/client";

export interface TestResult {
  ok: boolean;
  message: string;
}

/** Χρονικά φραγμένη fetch για να μην κολλάει το UI. */
async function timedFetch(url: string, init: RequestInit, ms = 15000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

async function testSoftOne(v: Record<string, string>): Promise<TestResult> {
  const serial = v.serial?.trim();
  if (!serial) return { ok: false, message: "Λείπει το Serial No." };
  const base = `https://${serial}.oncloud.gr/s1services`;

  async function s1(body: object): Promise<Record<string, unknown>> {
    const res = await timedFetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const buf = await res.arrayBuffer();
    return JSON.parse(iconv.decode(Buffer.from(buf), "win1253"));
  }

  const login = await s1({
    SERVICE: "Login",
    USERNAME: v.username,
    PASSWORD: v.password,
    APPID: v.appId,
    VERSION: "2",
  });
  if (!login.success) {
    return { ok: false, message: `Login απέτυχε: ${login.error ?? "άγνωστο σφάλμα"}` };
  }

  const auth = await s1({
    service: "authenticate",
    clientID: login.clientID,
    COMPANY: v.company,
    BRANCH: v.branch,
    MODULE: v.module,
    REFID: v.refid,
    VERSION: "2",
  });
  if (!auth.success) {
    return { ok: false, message: `Authenticate απέτυχε: ${auth.error ?? "άγνωστο σφάλμα"}` };
  }
  return { ok: true, message: "Επιτυχής σύνδεση με SoftOne (login + authenticate)." };
}

async function testWooCommerce(v: Record<string, string>): Promise<TestResult> {
  const base = stripTrailingSlash(v.baseUrl ?? "");
  if (!/^https:\/\//.test(base)) {
    return { ok: false, message: "Το Base URL πρέπει να ξεκινά με https://." };
  }
  const auth = Buffer.from(`${v.consumerKey}:${v.consumerSecret}`).toString("base64");
  const res = await timedFetch(`${base}/wp-json/wc/v3/products?per_page=1`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (res.ok) {
    return { ok: true, message: "Επιτυχής σύνδεση με WooCommerce REST API." };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "Άκυρα consumer key/secret ή ανεπαρκή δικαιώματα (HTTP " + res.status + ")." };
  }
  return { ok: false, message: `Αποτυχία σύνδεσης (HTTP ${res.status}).` };
}

async function testMagento(v: Record<string, string>): Promise<TestResult> {
  const base = stripTrailingSlash(v.baseUrl ?? "");
  if (!/^https?:\/\//.test(base)) {
    return { ok: false, message: "Το Base URL πρέπει να είναι έγκυρο URL." };
  }
  const res = await timedFetch(`${base}/rest/V1/store/storeViews`, {
    headers: { Authorization: `Bearer ${v.accessToken}` },
  });
  if (res.ok) {
    return { ok: true, message: "Επιτυχής σύνδεση με Magento REST API." };
  }
  if (res.status === 401) {
    return { ok: false, message: "Άκυρο access token (HTTP 401)." };
  }
  return { ok: false, message: `Αποτυχία σύνδεσης (HTTP ${res.status}).` };
}

async function testOpenCard(v: Record<string, string>): Promise<TestResult> {
  const base = stripTrailingSlash(v.baseUrl ?? "");
  if (!/^https?:\/\//.test(base)) {
    return { ok: false, message: "Το Base URL / Endpoint πρέπει να είναι έγκυρο URL." };
  }
  const headers: Record<string, string> = {};
  if (v.apiKey) headers["Authorization"] = `Bearer ${v.apiKey}`;
  if (v.apiKey) headers["X-Api-Key"] = v.apiKey;
  const res = await timedFetch(base, { headers });
  // Χωρίς τυποποιημένο health endpoint: αρκεί το endpoint να είναι προσβάσιμο.
  if (res.status < 500) {
    return { ok: true, message: `Το endpoint απάντησε (HTTP ${res.status}).` };
  }
  return { ok: false, message: `Το endpoint επέστρεψε σφάλμα (HTTP ${res.status}).` };
}

export async function runConnectorTest(
  type: ConnectorType,
  values: Record<string, string>,
): Promise<TestResult> {
  try {
    switch (type) {
      case "SOFTONE":
        return await testSoftOne(values);
      case "WOOCOMMERCE":
        return await testWooCommerce(values);
      case "MAGENTO":
        return await testMagento(values);
      case "OPENCARD":
        return await testOpenCard(values);
      default:
        return { ok: false, message: "Άγνωστος τύπος connector." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Άγνωστο σφάλμα.";
    if (msg.includes("aborted")) return { ok: false, message: "Λήξη χρονικού ορίου σύνδεσης." };
    return { ok: false, message: `Σφάλμα σύνδεσης: ${msg}` };
  }
}
