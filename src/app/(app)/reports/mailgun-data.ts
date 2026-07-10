import { getConnectorValues } from "@/lib/connectors/read";

/** Ένα σημείο χρονοσειράς (ανά ημέρα) στατιστικών Mailgun. */
export interface MailgunStatPoint {
  date: string; // ISO
  label: string; // π.χ. "10/07"
  accepted: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  unsubscribed: number;
  complained: number;
}

export interface MailgunTotals {
  accepted: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  unsubscribed: number;
  complained: number;
}

export interface MailgunStatsData {
  /** Έχει αποθηκευτεί ο connector (domain + apiKey). */
  configured: boolean;
  /** Είναι ενεργοποιημένος. */
  enabled: boolean;
  domain?: string;
  rangeDays: number;
  /** Μήνυμα σφάλματος αν απέτυχε η κλήση στο Mailgun. */
  error?: string;
  totals: MailgunTotals;
  /** Ποσοστά (0–100). */
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  failRate: number;
  points: MailgunStatPoint[];
}

const EVENTS = [
  "accepted",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "unsubscribed",
  "complained",
] as const;

const EMPTY_TOTALS: MailgunTotals = {
  accepted: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  failed: 0,
  unsubscribed: 0,
  complained: 0,
};

/** Εξάγει το «total» από έναν κόμβο event (χειρίζεται nested δομές όπως το failed). */
function nodeTotal(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  const obj = node as Record<string, unknown>;
  if (typeof obj.total === "number") return obj.total;
  let sum = 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>).total === "number") {
      sum += (v as { total: number }).total;
    } else if (typeof v === "number") {
      sum += v;
    }
  }
  return sum;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Φέρνει στατιστικά αποστολής email από το Mailgun Stats API
 * ({base}/v3/{domain}/stats/total) για το τελευταίο διάστημα `days`.
 */
export async function getMailgunStats(days = 30): Promise<MailgunStatsData> {
  const base_: MailgunStatsData = {
    configured: false,
    enabled: false,
    rangeDays: days,
    totals: { ...EMPTY_TOTALS },
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    failRate: 0,
    points: [],
  };

  const conn = await getConnectorValues("MAILGUN");
  const domain = conn?.config.domain?.trim();
  const apiKey = conn?.secrets.apiKey?.trim();
  if (!conn || !domain || !apiKey) {
    return base_;
  }
  base_.configured = true;
  base_.enabled = conn.enabled;
  base_.domain = domain;

  const baseUrl = (conn.config.baseUrl?.trim() || "https://api.mailgun.net").replace(/\/+$/, "");
  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const params = new URLSearchParams();
  for (const e of EVENTS) params.append("event", e);
  params.append("duration", `${days}d`);
  params.append("resolution", "day");

  const url = `${baseUrl}/v3/${encodeURIComponent(domain)}/stats/total?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      base_.error =
        res.status === 401
          ? "Άκυρο API Key (HTTP 401)."
          : res.status === 404
            ? "Το domain δεν βρέθηκε στο Mailgun (HTTP 404) — ελέγξτε domain/region."
            : `Αποτυχία λήψης στατιστικών (HTTP ${res.status}).`;
      return base_;
    }
    const json = (await res.json()) as { stats?: Array<Record<string, unknown>> };
    const stats = Array.isArray(json.stats) ? json.stats : [];

    const points: MailgunStatPoint[] = stats.map((row) => {
      const time = typeof row.time === "string" ? row.time : "";
      const d = time ? new Date(time) : null;
      const label = d
        ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
        : "";
      return {
        date: time,
        label,
        accepted: nodeTotal(row.accepted),
        delivered: nodeTotal(row.delivered),
        opened: nodeTotal(row.opened),
        clicked: nodeTotal(row.clicked),
        failed: nodeTotal(row.failed),
        unsubscribed: nodeTotal(row.unsubscribed),
        complained: nodeTotal(row.complained),
      };
    });

    const totals: MailgunTotals = { ...EMPTY_TOTALS };
    for (const p of points) {
      totals.accepted += p.accepted;
      totals.delivered += p.delivered;
      totals.opened += p.opened;
      totals.clicked += p.clicked;
      totals.failed += p.failed;
      totals.unsubscribed += p.unsubscribed;
      totals.complained += p.complained;
    }

    base_.points = points;
    base_.totals = totals;
    base_.deliveryRate = pct(totals.delivered, totals.accepted);
    base_.openRate = pct(totals.opened, totals.delivered);
    base_.clickRate = pct(totals.clicked, totals.delivered);
    base_.failRate = pct(totals.failed, totals.accepted);
    return base_;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Άγνωστο σφάλμα.";
    base_.error = msg.includes("aborted")
      ? "Λήξη χρονικού ορίου σύνδεσης με το Mailgun."
      : `Σφάλμα σύνδεσης: ${msg}`;
    return base_;
  } finally {
    clearTimeout(timer);
  }
}
